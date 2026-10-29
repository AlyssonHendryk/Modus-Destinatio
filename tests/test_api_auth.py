"""Isolated security tests; no real credentials or database connections."""
import importlib
import os
import secrets
import time
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch
from uuid import UUID

import jwt
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

from api_auth import AuthSettings, require_active_user, verify_token


class ApiAuthenticationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profile_client = MagicMock()
        # Prevent loading .env and prevent constructing a real Supabase client.
        with patch("dotenv.load_dotenv"), patch.dict(os.environ, {
            "SUPABASE_URL": "https://auth.example.test",
            "SUPABASE_KEY": "test-only-placeholder",
        }), patch("supabase.create_client", return_value=cls.profile_client):
            cls.main = importlib.import_module("main")
        cls.client = TestClient(cls.main.app)
        cls.signing_key = ec.generate_private_key(ec.SECP256R1())
        cls.user_id = "58cb19cc-7838-4d46-9d43-6705b9e22bde"

    def setUp(self):
        self.env = patch.dict(os.environ, {
            "SUPABASE_URL": "https://auth.example.test",
            "SUPABASE_JWT_ISSUER": "https://auth.example.test/auth/v1",
            "SUPABASE_JWT_ALGORITHM": "ES256",
            "SUPABASE_JWT_AUDIENCE": "test-users",
        }, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.key_lookup = patch("api_auth.jwks_client")
        lookup = self.key_lookup.start()
        self.addCleanup(self.key_lookup.stop)
        lookup.return_value.get_signing_key_from_jwt.return_value = SimpleNamespace(
            key=self.signing_key.public_key()
        )
        self.profile_client.reset_mock(return_value=True, side_effect=True)
        self.query = self.profile_client.schema.return_value.table.return_value
        self.result = self.query.select.return_value.eq.return_value.limit.return_value.execute
        self.set_profile()

    def set_profile(self, role="employee", status="active"):
        self.result.return_value = SimpleNamespace(data=[{
            "id": self.user_id, "role": role, "status": status,
        }])

    def token(self, **overrides):
        claims = {
            "sub": self.user_id, "iss": "https://auth.example.test/auth/v1",
            "aud": "test-users", "exp": int(time.time()) + 120,
            # Deliberately different from profiles: JWT role is not app authority.
            "role": "admin",
        }
        claims.update(overrides)
        return jwt.encode(claims, self.signing_key, algorithm="ES256", headers={"kid": "test-key"})

    def request(self, token):
        return self.client.get("/api/stock-movements", headers={"Authorization": "Bearer " + token})

    def test_all_private_routes_reject_missing_token_before_database(self):
        count = 0
        for route_path, operations in self.main.app.openapi()["paths"].items():
            if not route_path.startswith("/api/") or route_path == "/api/health":
                continue
            for method in operations:
                path = route_path.replace("{order_id}", "test").replace("{product_id}", "test")
                with self.subTest(method=method, path=path):
                    response = self.client.request(method, path, json={})
                    self.assertEqual(response.status_code, 401)
                    self.assertEqual(response.headers["www-authenticate"], "Bearer")
                count += 1
        self.assertEqual(count, 13)
        self.profile_client.assert_not_called()
        self.assertEqual(self.profile_client.mock_calls, [])

    def test_health_is_public(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        self.assertEqual(self.profile_client.mock_calls, [])

    def test_malformed_token(self):
        self.assertEqual(self.request("invalid").status_code, 401)
        self.assertEqual(self.profile_client.mock_calls, [])

    def test_invalid_signature(self):
        other_key = ec.generate_private_key(ec.SECP256R1())
        token = jwt.encode({"sub": self.user_id}, other_key, algorithm="ES256")
        self.assertEqual(self.request(token).status_code, 401)

    def test_expired_token(self):
        self.assertEqual(self.request(self.token(exp=int(time.time()) - 1)).status_code, 401)

    def test_wrong_issuer_and_audience(self):
        for claims in [{"iss": "https://other.example.test"}, {"aud": "other"}]:
            with self.subTest(claims=claims):
                self.assertEqual(self.request(self.token(**claims)).status_code, 401)

    def test_missing_required_claims(self):
        for name in ["exp", "iss", "aud", "sub"]:
            claims = jwt.decode(self.token(), options={"verify_signature": False})
            del claims[name]
            token = jwt.encode(claims, self.signing_key, algorithm="ES256")
            with self.subTest(claim=name):
                self.assertEqual(self.request(token).status_code, 401)

    def test_wrong_algorithm(self):
        token = jwt.encode({"sub": self.user_id}, secrets.token_bytes(64), algorithm="HS256")
        self.assertEqual(self.request(token).status_code, 401)

    def test_inactive_admin_and_employee(self):
        for role in ["employee", "admin"]:
            self.set_profile(role, "inactive")
            with self.subTest(role=role):
                self.assertEqual(self.request(self.token()).status_code, 403)

    def test_missing_duplicate_or_unknown_profile(self):
        for rows in [[], [{"id": self.user_id, "role": "owner", "status": "active"}], [{}, {}]]:
            self.result.return_value = SimpleNamespace(data=rows)
            with self.subTest(rows=rows):
                self.assertEqual(self.request(self.token()).status_code, 403)

    def test_admin_and_employee_use_existing_handler(self):
        for role in ["employee", "admin"]:
            self.set_profile(role)
            self.profile_client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[])
            with self.subTest(role=role):
                self.assertEqual(self.request(self.token()).status_code, 200)
                self.profile_client.schema.assert_called_with("public")
                self.query.select.return_value.eq.assert_called_with("id", self.user_id)

    def test_identity_comes_from_database_not_jwt_role(self):
        app = FastAPI()
        app.state.profile_client = self.profile_client

        @app.get("/identity")
        def identity(request: Request, user=Depends(require_active_user)):
            self.assertEqual(request.state.authenticated_user, user)
            return {"id": user.id, "role": user.role}

        client = TestClient(app)
        response = client.get("/identity", headers={"Authorization": "Bearer " + self.token()})
        self.assertEqual(response.json(), {"id": self.user_id, "role": "employee"})

    def test_stock_rpc_contract_preserved_for_admin(self):
        self.set_profile("admin")
        self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(data=11)
        response = self.client.patch(
            "/api/products/test-product/stock", json={"delta": 1},
            headers={"Authorization": "Bearer " + self.token()},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["newQuantity"], 11)
        self.profile_client.rpc.assert_called_once_with(
            "move_product_stock", {"p_product_id": "test-product", "p_delta": 1}
        )

    def administrative_requests(self):
        product = {
            "id": "test-product", "name": "Test product", "quantity": 10,
            "min": 1, "max": 100, "unitPrice": 2.5, "active": True,
        }
        order = {
            "id": "test-order", "supplier": "Test supplier", "operation": "Venda",
            "status": "waiting", "date": "01/01/2026", "total": 2.5,
            "items": [{"productId": "test-product", "product": "Test product",
                       "quantity": 1, "unitPrice": 2.5}],
        }
        return [
            ("POST", "/api/products", product),
            ("PUT", "/api/products/test-product", product),
            ("DELETE", "/api/products/test-product", None),
            ("PATCH", "/api/products/test-product/stock", {"delta": 1}),
            ("POST", "/api/orders", order),
            ("DELETE", "/api/orders/test-order", None),
            ("PUT", "/api/orders/test-order", order),
        ]

    def test_employee_denied_admin_operations_before_business_queries_or_rpc(self):
        self.set_profile("employee")
        # A forged application role in the token or body must not grant access.
        for method, path, body in self.administrative_requests():
            self.profile_client.reset_mock()
            payload = {**(body or {}), "role": "admin"}
            response = self.client.request(method, path, json=payload, headers={
                "Authorization": "Bearer " + self.token(role="admin"),
            })
            with self.subTest(method=method, path=path):
                self.assertEqual(response.status_code, 403)
                self.profile_client.table.assert_not_called()
                self.profile_client.rpc.assert_not_called()
                self.result.assert_called_once_with()

    def test_inactive_admin_denied_admin_operations(self):
        self.set_profile("admin", "inactive")
        for method, path, body in self.administrative_requests():
            self.profile_client.reset_mock()
            response = self.client.request(method, path, json=body, headers={
                "Authorization": "Bearer " + self.token(),
            })
            with self.subTest(method=method, path=path):
                self.assertEqual(response.status_code, 403)
                self.profile_client.table.assert_not_called()
                self.profile_client.rpc.assert_not_called()

    def test_admin_preserves_administrative_handlers_and_responses(self):
        self.set_profile("admin")
        for method, path, body in self.administrative_requests():
            self.profile_client.reset_mock()
            table = self.profile_client.table.return_value
            table.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[{"id": "test"}])
            table.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[])
            product_row = {
                "id": "test-product", "name": "Test product", "quantity": 10,
                "min": 1, "max": 100, "unit_price": 2.5, "active": True,
            }
            self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(
                data=11 if method == "PATCH" else [product_row]
            )
            table.update.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[product_row])
            order_response = {**self.administrative_requests()[4][2], "stock_applied": True}
            with patch("main.get_order_from_database", return_value=order_response):
                # JWT role differs deliberately: the admin profile is authority.
                response = self.client.request(method, path, json=body, headers={
                    "Authorization": "Bearer " + self.token(role="employee"),
                })
            with self.subTest(method=method, path=path):
                self.assertEqual(response.status_code, 201 if method == "POST" and path == "/api/products" else 200)
                self.result.assert_called_once_with()
                if method == "POST" and path == "/api/products":
                    self.assertEqual(response.json(), body)
                    self.profile_client.rpc.assert_called_once_with("create_product_with_stock", {
                        "p_id": body["id"], "p_name": body["name"], "p_quantity": body["quantity"],
                        "p_min": body["min"], "p_max": body["max"],
                        "p_unit_price": body["unitPrice"], "p_active": body["active"],
                    })
                elif method == "POST":
                    self.assertEqual(response.json(), order_response)
                    self.profile_client.rpc.assert_called_once_with("create_order_with_stock", {
                        "p_order_id": body["id"], "p_supplier": body["supplier"],
                        "p_operation": body["operation"], "p_status": body["status"],
                        "p_order_date": body["date"], "p_total": body["total"], "p_items": body["items"],
                    })
                elif method == "PUT" and path.startswith("/api/orders/"):
                    self.assertEqual(response.json(), order_response)
                    self.profile_client.rpc.assert_called_once_with("update_order_with_stock", {
                        "p_order_id": body["id"], "p_supplier": body["supplier"],
                        "p_operation": body["operation"], "p_status": body["status"],
                        "p_order_date": body["date"], "p_total": body["total"], "p_items": body["items"],
                    })
                elif method == "PUT":
                    self.assertEqual(response.json(), body)
                    table.update.assert_called_once_with({
                        "name": body["name"], "min": body["min"], "max": body["max"],
                        "unit_price": body["unitPrice"], "active": body["active"],
                    })
                elif method == "DELETE":
                    self.assertIn("message", response.json())
                    table.delete.assert_called_once_with()
                else:
                    self.assertEqual(response.json()["newQuantity"], 11)
                    self.profile_client.rpc.assert_called_once_with(
                        "move_product_stock", {"p_product_id": "test-product", "p_delta": 1}
                    )

    def test_employee_retains_all_gets(self):
        self.set_profile("employee")
        table = self.profile_client.table.return_value
        table.select.return_value.order.return_value.execute.return_value = SimpleNamespace(data=[])
        table.select.return_value.order.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[])
        headers = {"Authorization": "Bearer " + self.token()}
        for path in ["/api/products", "/api/orders", "/api/stock-movements"]:
            with self.subTest(path=path):
                response = self.client.get(path, headers=headers)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), [])

    def separation_request(self, body=None, token=None):
        return self.client.patch(
            "/api/orders/test-order/separation",
            json={"action": "start"} if body is None else body,
            headers={"Authorization": "Bearer " + (token or self.token())},
        )

    def test_separation_both_roles_actions_and_idempotent_results(self):
        for role in ["admin", "employee"]:
            self.set_profile(role)
            for action, status in [("start", "separating"), ("confirm", "completed")]:
                for changed in [True, False]:
                    self.profile_client.reset_mock()
                    self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(data=[{
                        "order_id": "test-order", "status": status, "changed": changed,
                    }])
                    response = self.separation_request({"action": action})
                    with self.subTest(role=role, action=action, changed=changed):
                        self.assertEqual(response.status_code, 200)
                        self.assertEqual(response.json(), {
                            "orderId": "test-order", "status": status, "changed": changed,
                        })
                        self.profile_client.rpc.assert_called_once_with("transition_order_separation", {
                            "p_order_id": "test-order", "p_action": action,
                        })
                        self.profile_client.table.assert_not_called()

    def test_separation_invalid_requests_do_not_call_rpc(self):
        bodies = [{}, {"action": "complete"}, {"action": None}, {"action": 1}]
        for name in ["items", "quantities", "unitPrice", "total", "status", "role"]:
            bodies.append({"action": "start", name: "not-allowed"})
        for body in bodies:
            self.profile_client.reset_mock()
            with self.subTest(body=body):
                self.assertEqual(self.separation_request(body).status_code, 422)
                self.profile_client.rpc.assert_not_called()
                self.profile_client.table.assert_not_called()

    def test_separation_inactive_and_invalid_profile(self):
        for role, status in [("admin", "inactive"), ("employee", "inactive"), ("owner", "active")]:
            self.set_profile(role, status)
            self.profile_client.reset_mock()
            with self.subTest(role=role, status=status):
                self.assertEqual(self.separation_request().status_code, 403)
                self.profile_client.rpc.assert_not_called()

    def test_separation_maps_sql_codes_without_internal_details(self):
        for code, expected in [("P2001", 422), ("P2002", 404), ("P2003", 409),
                               ("P2004", 409), ("P2005", 500), ("XX000", 500)]:
            self.profile_client.rpc.return_value.execute.side_effect = APIError({
                "code": code, "message": "private database detail", "details": "internal", "hint": "internal",
            })
            response = self.separation_request()
            with self.subTest(code=code):
                self.assertEqual(response.status_code, expected)
                self.assertNotIn("private database detail", response.text)
                self.assertNotIn("internal", response.text)

    def test_separation_rejects_invalid_rpc_shape_or_identity(self):
        valid = {"order_id": "test-order", "status": "separating", "changed": True}
        invalid = [None, {}, [], [valid, valid], [{}],
                   [{**valid, "order_id": "other-order"}],
                   [{**valid, "status": "completed"}],
                   [{**valid, "changed": "true"}], [{**valid, "changed": 1}],
                   [{**valid, "total": 99}],
                   [{"order_id": "test-order", "status": "separating"}]]
        for rows in invalid:
            self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(data=rows)
            with self.subTest(rows=rows):
                response = self.separation_request()
                self.assertEqual(response.status_code, 502)
                self.assertEqual(response.json(), {"detail": "Resposta inválida do serviço de separação."})

    def test_separation_unexpected_failure_is_sanitized(self):
        self.profile_client.rpc.return_value.execute.side_effect = RuntimeError("private database detail")
        response = self.separation_request()
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("private database detail", response.text)

    def financial_read_fixtures(self):
        # Include unrecognized and nested columns even though the real query
        # projects columns: serialization must independently enforce the contract.
        product = {
            "id": "P1", "name": "Test product", "quantity": 8, "min": 1, "max": 20,
            "active": True, "unit_price": 12.75, "price": 91, "cost": 37,
            "financial_metadata": {"margin": 77}, "unknown_column": "not-public",
        }
        order = {
            "id": "O1", "supplier": "Test supplier", "operation": "Venda",
            "status": "waiting", "order_date": "01/01/2026", "total": 25.5,
            "stock_applied": True, "revenue": 999, "unknown_column": "not-public",
            "order_items": [{
                "product_id": "P1", "product": "Test product", "quantity": 2,
                "unit_price": 12.75, "price": 65, "subtotal": 25.5,
                "financial_metadata": {"cost": 71}, "unknown_column": "not-public",
            }],
        }
        movement = {
            "id": 1, "product_id": "P1", "delta": -2,
            "previous_quantity": 10, "new_quantity": 8,
            "created_at": "2026-01-01T12:00:00+00:00",
            "unit_price": 12.75, "total": 25.5, "financial_metadata": {"cost": 71},
            "unknown_column": "not-public",
        }
        return product, order, movement

    def set_read_rows(self, rows, movements=False):
        table = self.profile_client.table.return_value
        ordered = table.select.return_value.order.return_value
        if movements:
            ordered.limit.return_value.execute.return_value = SimpleNamespace(data=rows)
        else:
            ordered.execute.return_value = SimpleNamespace(data=rows)
        return table

    def test_employee_product_response_is_operational_allowlist(self):
        product, _, _ = self.financial_read_fixtures()
        self.set_profile("employee")
        table = self.set_read_rows([product])
        response = self.client.get("/api/products?role=admin&include_financial=true", headers={
            "Authorization": "Bearer " + self.token(role="admin"),
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{
            "id": "P1", "name": "Test product", "quantity": 8,
            "min": 1, "max": 20, "active": True,
        }])
        table.select.assert_called_once_with("id,name,quantity,min,max,active")
        self.profile_client.rpc.assert_not_called()

    def test_employee_order_response_is_allowlisted_including_nested_items(self):
        _, order, _ = self.financial_read_fixtures()
        table = self.set_read_rows([order])
        response = self.client.get("/api/orders?role=admin&include_financial=true", headers={
            "Authorization": "Bearer " + self.token(role="admin"),
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{
            "id": "O1", "supplier": "Test supplier", "operation": "Venda",
            "status": "waiting", "date": "01/01/2026",
            "items": [{"productId": "P1", "product": "Test product", "quantity": 2}],
        }])
        table.select.assert_called_once_with(
            "id,supplier,operation,status,order_date,order_items(product_id,product,quantity)"
        )
        self.profile_client.rpc.assert_not_called()

    def test_admin_products_preserve_prices_and_legitimate_zero(self):
        product, _, _ = self.financial_read_fixtures()
        self.set_profile("admin")
        for price in [12.75, 0]:
            table = self.set_read_rows([{**product, "unit_price": price}])
            response = self.client.get("/api/products", headers={
                "Authorization": "Bearer " + self.token(role="employee"),
            })
            with self.subTest(price=price):
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), [{
                    "id": "P1", "name": "Test product", "quantity": 8,
                    "min": 1, "max": 20, "active": True, "unitPrice": price,
                }])
                table.select.assert_called_with("id,name,quantity,min,max,active,unit_price")

    def test_admin_orders_preserve_totals_nested_prices_and_zero(self):
        _, order, _ = self.financial_read_fixtures()
        self.set_profile("admin")
        for total, price in [(25.5, 12.75), (0, 0)]:
            row = {**order, "total": total, "order_items": [{**order["order_items"][0], "unit_price": price}]}
            table = self.set_read_rows([row])
            response = self.client.get("/api/orders", headers={
                "Authorization": "Bearer " + self.token(role="employee"),
            })
            with self.subTest(total=total, price=price):
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), [{
                    "id": "O1", "supplier": "Test supplier", "operation": "Venda",
                    "status": "waiting", "date": "01/01/2026", "total": total,
                    "stock_applied": True,
                    "items": [{"productId": "P1", "product": "Test product", "quantity": 2, "unitPrice": price}],
                }])
                table.select.assert_called_with(
                    "id,supplier,operation,status,order_date,total,stock_applied,"
                    "order_items(product_id,product,quantity,unit_price)"
                )

    def test_movements_are_explicitly_projected_for_both_roles(self):
        _, _, movement = self.financial_read_fixtures()
        expected = {key: movement[key] for key in [
            "id", "product_id", "delta", "previous_quantity", "new_quantity", "created_at",
        ]}
        for role in ["employee", "admin"]:
            self.set_profile(role)
            table = self.set_read_rows([movement], movements=True)
            response = self.request(self.token())
            with self.subTest(role=role):
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), [expected])
                table.select.assert_called_with(
                    "id,product_id,delta,previous_quantity,new_quantity,created_at"
                )
                table.select.return_value.order.assert_called_with("created_at", desc=True)
                table.select.return_value.order.return_value.limit.assert_called_with(100)
                self.profile_client.rpc.assert_not_called()

    def test_get_errors_never_expose_database_details_or_validation_input(self):
        for role in ["employee", "admin"]:
            self.set_profile(role)
            for path in ["/api/products", "/api/orders", "/api/stock-movements"]:
                for mode in ["database_error", "invalid_row"]:
                    ordered = self.profile_client.table.return_value.select.return_value.order.return_value
                    execute = ordered.limit.return_value.execute if path.endswith("stock-movements") else ordered.execute
                    execute.side_effect = RuntimeError("private financial record total=98765") if mode == "database_error" else None
                    execute.return_value = SimpleNamespace(data=[{"id": {"private_financial_record": 98765}}])
                    response = self.client.get(path, headers={"Authorization": "Bearer " + self.token()})
                    with self.subTest(role=role, path=path, mode=mode):
                        self.assertEqual(response.status_code, 500)
                        self.assertEqual(set(response.json()), {"detail"})
                        self.assertNotIn("98765", response.text)
                        self.assertNotIn("private", response.text)

    def test_administrative_input_models_still_require_financial_fields(self):
        self.set_profile("admin")
        product = self.administrative_requests()[0][2].copy()
        del product["unitPrice"]
        order = self.administrative_requests()[4][2]
        for body in [
            {key: value for key, value in order.items() if key != "total"},
            {**order, "items": [{key: value for key, value in order["items"][0].items() if key != "unitPrice"}]},
        ]:
            for method, path in [("POST", "/api/orders"), ("PUT", "/api/orders/test-order")]:
                with self.subTest(method=method, path=path, body=body):
                    response = self.client.request(method, path, json=body, headers={"Authorization": "Bearer " + self.token()})
                    self.assertEqual(response.status_code, 422)
        for method, path in [("POST", "/api/products"), ("PUT", "/api/products/test-product")]:
            response = self.client.request(method, path, json=product, headers={"Authorization": "Bearer " + self.token()})
            self.assertEqual(response.status_code, 422)
        self.profile_client.table.assert_not_called()
        self.profile_client.rpc.assert_not_called()

    def test_jwks_connection_failure(self):
        with patch("api_auth.jwks_client") as lookup:
            lookup.return_value.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientConnectionError()
            self.assertEqual(self.request(self.token()).status_code, 503)

    def test_hs256_requires_server_signing_secret(self):
        with patch.dict(os.environ, {"SUPABASE_JWT_ALGORITHM": "HS256"}):
            self.assertEqual(self.request(self.token()).status_code, 503)

    def test_profile_unavailable_fails_closed(self):
        self.result.side_effect = RuntimeError("must not be exposed")
        response = self.request(self.token())
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("must not be exposed", response.text)

    def test_missing_config_fails_closed(self):
        for name in ["SUPABASE_JWT_ALGORITHM", "SUPABASE_JWT_AUDIENCE"]:
            with patch.dict(os.environ):
                del os.environ[name]
                self.assertEqual(self.request(self.token()).status_code, 503)

    def test_legacy_hs256_verifies_real_signature(self):
        secret = secrets.token_bytes(64)
        settings = AuthSettings("https://auth.example.test/auth/v1", "test-users", "HS256", secret)
        claims = {"sub": self.user_id, "iss": settings.issuer, "aud": settings.audience, "exp": int(time.time()) + 120}
        self.assertEqual(verify_token(jwt.encode(claims, secret, algorithm="HS256"), settings)["sub"], self.user_id)
        with self.assertRaises(Exception) as error:
            verify_token(jwt.encode(claims, secrets.token_bytes(64), algorithm="HS256"), settings)
        self.assertEqual(error.exception.status_code, 401)

    def test_rs256_verifies_real_signature(self):
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        with patch("api_auth.jwks_client") as lookup:
            lookup.return_value.get_signing_key_from_jwt.return_value = SimpleNamespace(key=key.public_key())
            settings = AuthSettings("https://auth.example.test/auth/v1", "test-users", "RS256")
            claims = {"sub": self.user_id, "iss": settings.issuer, "aud": settings.audience, "exp": int(time.time()) + 120}
            self.assertEqual(verify_token(jwt.encode(claims, key, algorithm="RS256"), settings)["sub"], self.user_id)

    def employee_payload(self, **overrides):
        payload = {
            "name": "Funcionário de teste",
            "email": "funcionario.teste@example.test",
            "password": secrets.token_urlsafe(24),
        }
        payload.update(overrides)
        return payload

    def prepare_employee_creation(self, role="admin", profile_rows=None):
        self.set_profile(role)
        self.new_employee_id = "6f76db2f-33db-44ea-ae50-eec7ea8e0660"
        self.profile_rows = [] if profile_rows is None else profile_rows
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": role, "status": "active"}]),
            SimpleNamespace(data=self.profile_rows),
        ]
        self.profile_client.auth.admin.create_user.return_value = SimpleNamespace(
            user=SimpleNamespace(id=self.new_employee_id, email="funcionario.teste@example.test")
        )
        self.query.insert.return_value.execute.return_value = SimpleNamespace(data=[{
            "id": self.new_employee_id,
            "name": "Funcionário de teste",
            "role": "employee",
            "status": "active",
        }])

    def create_employee_request(self, payload=None, token=None):
        return self.client.post(
            "/api/admin/users", json=payload or self.employee_payload(),
            headers={"Authorization": "Bearer " + (token or self.token())},
        )

    def test_admin_can_provision_employee_without_replacing_session(self):
        self.prepare_employee_creation()
        payload = self.employee_payload(email="Funcionario.Teste@Example.Test")
        response = self.create_employee_request(payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), {
            "id": self.new_employee_id, "name": payload["name"],
            "role": "employee", "status": "active",
        })
        self.profile_client.auth.admin.create_user.assert_called_once_with({
            "email": "funcionario.teste@example.test", "password": payload["password"], "email_confirm": True,
        })
        self.query.insert.assert_called_once_with({
            "id": self.new_employee_id, "name": payload["name"],
            "role": "employee", "status": "active",
        })
        self.profile_client.auth.sign_in_with_password.assert_not_called()
        self.profile_client.auth.sign_up.assert_not_called()
        self.profile_client.auth.set_session.assert_not_called()

    def test_employee_and_unauthenticated_cannot_provision_users(self):
        payload = self.employee_payload()
        response = self.create_employee_request(payload, token=self.token())
        self.assertEqual(response.status_code, 403)
        self.profile_client.auth.admin.create_user.assert_not_called()
        self.query.insert.assert_not_called()

        self.profile_client.reset_mock(return_value=True, side_effect=True)
        response = self.client.post("/api/admin/users", json=payload)
        self.assertEqual(response.status_code, 401)
        self.profile_client.assert_not_called()

    def test_employee_creation_rejects_forbidden_and_invalid_input_without_echoing_password(self):
        invalid_payloads = [
            self.employee_payload(role="admin"),
            self.employee_payload(status="active"),
            self.employee_payload(id=self.new_employee_id if hasattr(self, "new_employee_id") else self.user_id),
            self.employee_payload(extra="not allowed"),
            self.employee_payload(name="   "),
            self.employee_payload(name="x" * 121),
            self.employee_payload(email="invalid-email"),
            self.employee_payload(email="a@invalid"),
            self.employee_payload(email=[]),
            self.employee_payload(password="short"),
            self.employee_payload(password=" " * 8),
            self.employee_payload(password=["not", "a", "string"]),
        ]
        self.set_profile("admin")
        for payload in invalid_payloads:
            self.result.return_value = SimpleNamespace(data=[{
                "id": self.user_id, "role": "admin", "status": "active",
            }])
            response = self.create_employee_request(payload)
            with self.subTest(payload={key: value for key, value in payload.items() if key != "password"}):
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json(), {"detail": "Dados de cadastro inválidos."})
                self.assertNotIn(str(payload["password"]), response.text)
        self.profile_client.auth.admin.create_user.assert_not_called()
        self.query.insert.assert_not_called()

    def test_duplicate_auth_email_is_sanitized_and_never_changes_existing_account(self):
        self.prepare_employee_creation()
        self.profile_client.auth.admin.create_user.side_effect = AuthApiError(
            "provider detail must not escape", 422, "email_exists"
        )
        response = self.create_employee_request()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"detail": "Já existe uma conta com este e-mail."})
        self.query.insert.assert_not_called()
        self.profile_client.auth.admin.delete_user.assert_not_called()
        self.assertNotIn("provider detail", response.text)

    def test_auth_failure_is_sanitized_without_profile_write(self):
        self.prepare_employee_creation()
        self.profile_client.auth.admin.create_user.side_effect = RuntimeError("raw auth failure")
        with self.assertLogs("admin_users", level="ERROR") as logs:
            response = self.create_employee_request()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json(), {"detail": "Não foi possível criar o funcionário."})
        self.assertEqual(logs.output, ["ERROR:admin_users:employee_creation_auth_outcome_unknown"])
        self.query.insert.assert_not_called()
        self.profile_client.auth.admin.delete_user.assert_not_called()
        self.assertNotIn("raw auth failure", response.text)

    def test_profile_failure_compensates_only_the_proven_new_auth_user(self):
        self.prepare_employee_creation()
        self.query.insert.return_value.execute.side_effect = RuntimeError("profile write failed")
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[]),
            SimpleNamespace(data=[]),
        ]
        with self.assertLogs("admin_users", level="WARNING") as logs:
            response = self.create_employee_request()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": "Não foi possível concluir o cadastro do funcionário."})
        self.profile_client.auth.admin.delete_user.assert_called_once_with(self.new_employee_id)
        self.assertEqual(logs.output, ["WARNING:admin_users:employee_creation_compensated"])

    def test_existing_or_uncertain_profile_is_never_overwritten_or_deleted(self):
        existing = [{"id": "existing-profile", "name": "Existing", "role": "employee", "status": "active"}]
        self.prepare_employee_creation(profile_rows=existing)
        with self.assertLogs("admin_users", level="ERROR") as logs:
            response = self.create_employee_request()
        self.assertEqual(response.status_code, 500)
        self.query.insert.assert_not_called()
        self.profile_client.auth.admin.delete_user.assert_not_called()
        self.assertEqual(logs.output, ["ERROR:admin_users:employee_creation_reconciliation_required"])

        self.prepare_employee_creation()
        self.query.insert.return_value.execute.return_value = SimpleNamespace(data=[])
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[]),
            SimpleNamespace(data=[{"id": self.new_employee_id}]),
        ]
        with self.assertLogs("admin_users", level="ERROR") as uncertain_logs:
            response = self.create_employee_request()
        self.assertEqual(response.status_code, 500)
        self.profile_client.auth.admin.delete_user.assert_not_called()
        self.assertEqual(uncertain_logs.output, ["ERROR:admin_users:employee_creation_reconciliation_required"])

    def directory_user(self, value, email=None):
        user_id = str(UUID(int=value))
        return SimpleNamespace(
            id=user_id,
            email=email or f"employee-{value}@example.test",
            encrypted_password="must-not-leak",
            user_metadata={"private": "must-not-leak"},
        )

    def directory_profile(self, value, **overrides):
        profile = {
            "id": str(UUID(int=value)), "name": f"Employee {value}",
            "role": "employee", "status": "active",
            "created_at": f"2026-01-01T00:{value // 60:02d}:{value % 60:02d}Z",
            "financial_data": "must-not-leak",
        }
        profile.update(overrides)
        return profile

    def prepare_user_directory(self, auth_pages, profile_pages):
        self.set_profile("admin")
        self.profile_client.auth.admin.list_users.side_effect = auth_pages
        self.directory_result = self.query.select.return_value.order.return_value.range.return_value.execute
        self.directory_result.side_effect = [SimpleNamespace(data=page) for page in profile_pages]

    def list_users_request(self, suffix="", token=None):
        return self.client.get(
            "/api/admin/users" + suffix,
            headers={"Authorization": "Bearer " + (token or self.token())},
        )

    def test_admin_lists_only_allowlisted_uuid_linked_accounts(self):
        auth_users = [self.directory_user(2), self.directory_user(1)]
        profiles = [self.directory_profile(1), self.directory_profile(2)]
        self.prepare_user_directory([auth_users], [profiles])
        response = self.list_users_request()
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), {"users", "page", "per_page", "total"})
        self.assertEqual((body["page"], body["per_page"], body["total"]), (1, 25, 2))
        self.assertEqual([user["id"] for user in body["users"]], [str(UUID(int=1)), str(UUID(int=2))])
        self.assertEqual(set(body["users"][0]), {"id", "name", "email", "role", "status", "created_at"})
        self.assertEqual(body["users"][0]["email"], "employee-1@example.test")
        self.assertNotIn("must-not-leak", response.text)
        self.profile_client.auth.admin.list_users.assert_called_once_with(page=1, per_page=100)
        self.query.select.return_value.order.assert_called_once_with("id")
        self.query.select.return_value.order.return_value.range.assert_called_once_with(0, 99)

    def test_admin_user_listing_rejects_unauthenticated_and_employee_before_admin_api(self):
        response = self.list_users_request()
        self.assertEqual(response.status_code, 403)
        self.profile_client.auth.admin.list_users.assert_not_called()

        self.profile_client.reset_mock(return_value=True, side_effect=True)
        response = self.client.get("/api/admin/users")
        self.assertEqual(response.status_code, 401)
        self.profile_client.assert_not_called()

    def test_admin_user_listing_scans_internal_pages_before_returning_stable_response_page(self):
        auth_pages = [
            [self.directory_user(value) for value in range(1, 101)],
            [self.directory_user(101)],
        ]
        profile_pages = [
            [self.directory_profile(value) for value in range(1, 101)],
            [self.directory_profile(101)],
        ]
        self.prepare_user_directory(auth_pages, profile_pages)
        response = self.list_users_request("?page=2&per_page=25")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual((body["page"], body["per_page"], body["total"]), (2, 25, 101))
        returned_ids = [row["id"] for row in body["users"]]
        self.assertEqual(returned_ids, [str(UUID(int=value)) for value in range(26, 51)])
        self.assertEqual(len(returned_ids), len(set(returned_ids)))
        self.assertEqual(self.profile_client.auth.admin.list_users.call_args_list, [
            call(page=1, per_page=100), call(page=2, per_page=100),
        ])
        self.assertEqual(self.query.select.return_value.order.return_value.range.call_args_list, [
            call(0, 99), call(100, 199),
        ])

    def test_admin_user_listing_fails_closed_for_orphaned_records_and_dependency_failures(self):
        self.prepare_user_directory([[self.directory_user(1)]], [[]])
        with self.assertLogs("admin_users", level="WARNING") as logs:
            response = self.list_users_request()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"detail": "A lista de usuários requer reconciliação administrativa."})
        self.assertEqual(logs.output, ["WARNING:admin_users:admin_users_list_reconciliation_required"])

        self.prepare_user_directory([[]], [[self.directory_profile(2)]])
        with self.assertLogs("admin_users", level="WARNING") as logs:
            response = self.list_users_request()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"detail": "A lista de usuários requer reconciliação administrativa."})
        self.assertEqual(logs.output, ["WARNING:admin_users:admin_users_list_reconciliation_required"])

        self.prepare_user_directory([[self.directory_user(1)]], [[self.directory_profile(1)]])
        self.profile_client.auth.admin.list_users.side_effect = RuntimeError("auth raw detail")
        with self.assertLogs("admin_users", level="ERROR") as logs:
            response = self.list_users_request()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json(), {"detail": "Não foi possível consultar os usuários."})
        self.assertEqual(logs.output, ["ERROR:admin_users:admin_users_list_auth_failed"])
        self.assertNotIn("auth raw detail", response.text)

        self.prepare_user_directory([[self.directory_user(1)]], [[self.directory_profile(1)]])
        self.directory_result.side_effect = RuntimeError("profile raw detail")
        with self.assertLogs("admin_users", level="ERROR") as logs:
            response = self.list_users_request()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Não foi possível consultar os usuários."})
        self.assertEqual(logs.output, ["ERROR:admin_users:admin_users_list_profiles_failed"])
        self.assertNotIn("profile raw detail", response.text)


if __name__ == "__main__":
    unittest.main()
