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
        self.audit_request_ids = set()
        self.query = self.profile_client.schema.return_value.table.return_value
        self.result = self.query.select.return_value.eq.return_value.limit.return_value.execute
        self.set_profile()

    def set_profile(self, role="employee", status="active"):
        self.result.side_effect = None
        self.result.return_value = SimpleNamespace(data=[{
            "id": self.user_id, "role": role, "status": status,
        }])

    def assert_audit_rpc(self, name, parameters):
        self.profile_client.rpc.assert_called_once()
        actual_name, actual = self.profile_client.rpc.call_args.args
        self.assertEqual(actual_name, name)
        request_id = actual.get("p_request_id")
        self.assertEqual(str(UUID(request_id)), request_id)
        self.assertEqual(UUID(request_id).version, 4)
        self.assertNotIn(request_id, self.audit_request_ids)
        self.audit_request_ids.add(request_id)
        self.assertEqual(actual, {**parameters, "p_actor_id": self.user_id, "p_request_id": request_id})

    def assert_auth_audit(self, operation, outcome, *, admin_creation=False, **metadata):
        rpc_calls = self.profile_client.rpc.call_args_list
        self.assertEqual(len(rpc_calls), 2)
        intent_name, intent = rpc_calls[0].args
        result_name, result = rpc_calls[1].args
        self.assertEqual(intent_name, "audit_admin_creation_requested" if admin_creation else f"audit_employee_{operation}_requested")
        self.assertEqual(result_name, f"audit_employee_{operation}_result")
        request_id = intent["p_request_id"]
        self.assertEqual(str(UUID(request_id)), request_id)
        self.assertEqual(UUID(request_id).version, 4)
        self.assertNotIn(request_id, self.audit_request_ids)
        self.audit_request_ids.add(request_id)
        base = {"p_actor_id": self.user_id, "p_request_id": request_id}
        if operation == "deletion":
            base["p_user_id"] = metadata["p_user_id"]
        self.assertEqual(intent, base)
        self.assertEqual(result, {**base, "p_outcome": outcome, **metadata})
        calls = self.profile_client.mock_calls
        external = "create_user" if operation == "creation" else "delete_user"
        intent_index = calls.index(call.rpc(intent_name, intent))
        external_index = next(i for i, item in enumerate(calls) if item[0] == f"auth.admin.{external}")
        result_index = calls.index(call.rpc(result_name, result))
        self.assertLess(intent_index, external_index)
        self.assertLess(external_index, result_index)

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
        self.assertEqual(count, 18)
        self.profile_client.assert_not_called()
        self.assertEqual(self.profile_client.mock_calls, [])

    def profile_name_request(self, body):
        return self.client.patch("/api/profile", json=body,
            headers={"Authorization": "Bearer " + self.token()})

    def test_both_roles_update_only_their_own_persisted_name(self):
        for role in ("admin", "employee"):
            with self.subTest(role=role):
                self.set_profile(role)
                self.profile_client.rpc.reset_mock()
                self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(data=[{
                    "id": self.user_id, "name": "Updated Name", "role": role, "status": "active",
                }])
                self.query.update.reset_mock()
                response = self.profile_name_request({"name": "  Updated Name  "})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), {"id": self.user_id, "name": "Updated Name"})
                self.profile_client.schema.assert_called_with("public")
                self.profile_client.schema.return_value.table.assert_called_with("profiles")
                self.assert_audit_rpc("audit_update_own_name", {"p_name": "Updated Name"})
                self.query.update.assert_not_called()

    def test_profile_name_rejects_inactive_and_unauthenticated_users_before_update(self):
        self.assertEqual(self.client.patch("/api/profile", json={"name": "Name"}).status_code, 401)
        self.query.update.assert_not_called()
        self.set_profile(status="inactive")
        self.assertEqual(self.profile_name_request({"name": "Name"}).status_code, 403)
        self.query.update.assert_not_called()
        self.profile_client.rpc.assert_not_called()

    def test_profile_name_rejects_invalid_names_and_all_extra_fields(self):
        for body in [{}, {"name": ""}, {"name": "   "}, {"name": "x" * 121},
                     {"name": None}, {"name": 123}, {"name": []}]:
            with self.subTest(body=body):
                self.assertEqual(self.profile_name_request(body).status_code, 422)
        for field in ("id", "role", "status", "email", "phone", "password", "user_id", "p_actor_id", "p_request_id"):
            with self.subTest(field=field):
                self.assertEqual(self.profile_name_request({"name": "Name", field: "another-account"}).status_code, 422)
        self.query.update.assert_not_called()

    def test_profile_name_failure_is_sanitized_and_unconfirmed_update_never_succeeds(self):
        execute = self.profile_client.rpc.return_value.execute
        execute.side_effect = RuntimeError("private database detail")
        response = self.profile_name_request({"name": "Name"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private database detail", response.text)
        execute.side_effect = None
        for rows, expected in [([], 403), ([{"id": "another-account", "name": "Name"}], 503),
                               ([{"id": self.user_id, "name": "Old"}], 503)]:
            execute.return_value = SimpleNamespace(data=rows)
            self.assertEqual(self.profile_name_request({"name": "Name"}).status_code, expected)

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
        self.assert_audit_rpc(
            "audit_adjust_stock", {"p_product_id": "test-product", "p_delta": 1}
        )

    def administrative_requests(self):
        product = {
            "id": "test-product", "name": "Test product", "quantity": 10,
            "min": 1, "max": 100, "unitPrice": 2.5, "active": True,
        }
        order = {
            "id": "test-order", "customer": "Test customer", "supplier": "Test supplier", "operation": "Venda",
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
                    self.assert_audit_rpc("audit_create_product", {
                        "p_id": body["id"], "p_name": body["name"], "p_quantity": body["quantity"],
                        "p_min": body["min"], "p_max": body["max"],
                        "p_unit_price": body["unitPrice"], "p_active": body["active"],
                    })
                elif method == "POST":
                    self.assertEqual(response.json(), order_response)
                    self.assert_audit_rpc("audit_create_order", {
                        "p_order_id": body["id"], "p_supplier": body["supplier"],
                        "p_customer": body["customer"],
                        "p_operation": body["operation"], "p_status": body["status"],
                        "p_order_date": body["date"], "p_total": body["total"], "p_items": body["items"],
                    })
                elif method == "PUT" and path.startswith("/api/orders/"):
                    self.assertEqual(response.json(), order_response)
                    self.assert_audit_rpc("audit_update_order", {
                        "p_order_id": body["id"], "p_supplier": body["supplier"],
                        "p_customer": body["customer"],
                        "p_operation": body["operation"], "p_status": body["status"],
                        "p_order_date": body["date"], "p_total": body["total"], "p_items": body["items"],
                    })
                elif method == "PUT":
                    self.assertEqual(response.json(), body)
                    self.assert_audit_rpc("audit_update_product", {
                        "p_id": body["id"], "p_name": body["name"], "p_min": body["min"], "p_max": body["max"],
                        "p_unit_price": body["unitPrice"], "p_active": body["active"],
                    })
                elif method == "DELETE":
                    self.assertIn("message", response.json())
                    kind = "product" if "/products/" in path else "order"
                    self.assert_audit_rpc(f"audit_delete_{kind}", {f"p_{kind}_id": f"test-{kind}"})
                    table.delete.assert_not_called()
                else:
                    self.assertEqual(response.json()["newQuantity"], 11)
                    self.assert_audit_rpc(
                        "audit_adjust_stock", {"p_product_id": "test-product", "p_delta": 1}
                    )

    def test_completed_order_rejects_all_put_changes_using_persisted_status(self):
        self.set_profile("admin")
        order = self.administrative_requests()[4][2]
        persisted = {**order, "status": "completed", "stock_applied": True}
        changes = [
            {"status": "waiting"}, {"customer": "Other customer"},
            {"supplier": "Other supplier"}, {"total": 500},
            {"items": [{**order["items"][0], "quantity": 2}]},
        ]
        for change in changes:
            with self.subTest(change=change), patch("main.get_order_from_database", return_value=persisted):
                self.profile_client.rpc.reset_mock()
                response = self.client.put("/api/orders/test-order", json={**order, **change},
                    headers={"Authorization": "Bearer " + self.token()})
                self.assertEqual(response.status_code, 409)
                self.assertIn("conclu", response.json()["detail"])
                self.profile_client.rpc.assert_not_called()

    def test_noncompleted_order_put_remains_editable_and_missing_order_is_not_updated(self):
        self.set_profile("admin")
        order = self.administrative_requests()[4][2]
        for status in ("waiting", "separating", "shipped"):
            with self.subTest(status=status), patch("main.get_order_from_database", return_value={**order, "status": status}):
                self.profile_client.rpc.reset_mock()
                response = self.client.put("/api/orders/test-order", json=order,
                    headers={"Authorization": "Bearer " + self.token()})
                self.assertEqual(response.status_code, 200)
                self.profile_client.rpc.assert_called_once()
        with patch("main.get_order_from_database", return_value=None):
            self.profile_client.rpc.reset_mock()
            response = self.client.put("/api/orders/test-order", json=order,
                headers={"Authorization": "Bearer " + self.token()})
            self.assertEqual(response.status_code, 404)
            self.profile_client.rpc.assert_not_called()

    def test_order_write_keeps_customer_distinct_and_accepts_legacy_null(self):
        self.set_profile("admin")
        order = self.administrative_requests()[4][2]
        legacy_request = {key: value for key, value in order.items() if key != "customer"}
        legacy_response = {**legacy_request, "customer": None, "stock_applied": True}

        with patch("main.get_order_from_database", return_value=legacy_response):
            response = self.client.post(
                "/api/orders", json=legacy_request,
                headers={"Authorization": "Bearer " + self.token()},
            )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["customer"])
        self.assertEqual(response.json()["supplier"], "Test supplier")
        self.assert_audit_rpc(
            "audit_create_order", {
                "p_order_id": legacy_request["id"],
                "p_supplier": "Test supplier", "p_customer": None,
                "p_operation": legacy_request["operation"], "p_status": legacy_request["status"],
                "p_order_date": legacy_request["date"], "p_total": legacy_request["total"],
                "p_items": legacy_request["items"],
            },
        )
        self.assertNotIn("create_order_with_stock", str(self.profile_client.rpc.call_args))

    def test_order_parties_reject_blank_values_without_rpc(self):
        self.set_profile("admin")
        order = self.administrative_requests()[4][2]
        for field in ("customer", "supplier"):
            with self.subTest(field=field):
                self.profile_client.rpc.reset_mock()
                response = self.client.post(
                    "/api/orders", json={**order, field: "   "},
                    headers={"Authorization": "Bearer " + self.token()},
                )
                self.assertEqual(response.status_code, 422)
                self.profile_client.rpc.assert_not_called()

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
                        self.assert_audit_rpc("audit_transition_order_separation", {
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
            "id": "O1", "customer": "Test customer", "supplier": "Test supplier", "operation": "Venda",
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
            "id": "O1", "customer": "Test customer", "supplier": "Test supplier", "operation": "Venda",
            "status": "waiting", "date": "01/01/2026",
            "items": [{"productId": "P1", "product": "Test product", "quantity": 2}],
        }])
        table.select.assert_called_once_with(
            "id,customer,supplier,operation,status,order_date,order_items(product_id,product,quantity)"
        )
        self.profile_client.rpc.assert_not_called()

    def test_legacy_order_null_customer_is_read_without_supplier_fallback(self):
        _, order, _ = self.financial_read_fixtures()
        self.set_profile("employee")
        legacy_order = {**order, "customer": None}
        table = self.set_read_rows([legacy_order])

        response = self.client.get("/api/orders", headers={
            "Authorization": "Bearer " + self.token(),
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{
            "id": "O1", "customer": None, "supplier": "Test supplier",
            "operation": "Venda", "status": "waiting", "date": "01/01/2026",
            "items": [{"productId": "P1", "product": "Test product", "quantity": 2}],
        }])
        table.select.assert_called_once_with(
            "id,customer,supplier,operation,status,order_date,order_items(product_id,product,quantity)"
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
                    "id": "O1", "customer": "Test customer", "supplier": "Test supplier", "operation": "Venda",
                    "status": "waiting", "date": "01/01/2026", "total": total,
                    "stock_applied": True,
                    "items": [{"productId": "P1", "product": "Test product", "quantity": 2, "unitPrice": price}],
                }])
                table.select.assert_called_with(
                    "id,customer,supplier,operation,status,order_date,total,stock_applied,"
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
        self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(data=1)
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
        self.assert_auth_audit("creation", "succeeded", p_user_id=self.new_employee_id)

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

    def test_admin_creation_requires_committed_explicit_audit_and_preserves_session(self):
        self.prepare_employee_creation()
        profile = {"id": self.new_employee_id, "name": "Funcionário de teste", "role": "admin", "status": "active"}
        self.profile_client.rpc.return_value.execute.side_effect = [
            SimpleNamespace(data=1), SimpleNamespace(data=[profile]), SimpleNamespace(data=2),
        ]
        payload = self.employee_payload(role="admin")
        response = self.create_employee_request(payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["role"], "admin")
        first_call = self.profile_client.rpc.call_args_list[0]
        self.assertEqual(first_call.args[0], "audit_admin_creation_requested")
        self.assertEqual(first_call.args[1]["p_actor_id"], self.user_id)
        self.query.insert.assert_not_called()
        calls = self.profile_client.rpc.call_args_list
        self.assertEqual([c.args[0] for c in calls], [
            "audit_admin_creation_requested", "audit_complete_admin_creation", "audit_employee_creation_result",
        ])
        self.assertEqual(calls[1].args[1], {
            **first_call.args[1], "p_user_id": self.new_employee_id, "p_name": payload["name"],
        })
        self.assertEqual(calls[2].args[1], {**first_call.args[1], "p_user_id": self.new_employee_id, "p_outcome": "succeeded"})
        self.profile_client.auth.sign_in_with_password.assert_not_called()
        self.profile_client.auth.set_session.assert_not_called()

    def test_admin_creation_stops_before_auth_if_new_sql_audit_is_unavailable(self):
        self.prepare_employee_creation()
        self.profile_client.rpc.return_value.execute.side_effect = RuntimeError("internal detail")
        response = self.create_employee_request(self.employee_payload(role="admin"))
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("internal detail", response.text)
        self.profile_client.auth.admin.create_user.assert_not_called()
        self.query.insert.assert_not_called()

    def test_admin_creation_duplicate_email_never_changes_an_existing_account(self):
        self.prepare_employee_creation()
        self.profile_client.auth.admin.create_user.side_effect = AuthApiError("private provider data", 422, "email_exists")
        response = self.create_employee_request(self.employee_payload(role="admin"))
        self.assertEqual(response.status_code, 409)
        self.assertNotIn("private provider", response.text)
        self.query.insert.assert_not_called()
        self.profile_client.auth.admin.delete_user.assert_not_called()
        self.assert_auth_audit("creation", "failed", admin_creation=True, p_stage="auth_create", p_reason_code="account_exists")

    def test_admin_profile_failure_only_compensates_the_proven_new_uuid(self):
        self.prepare_employee_creation()
        self.profile_client.rpc.return_value.execute.side_effect = [SimpleNamespace(data=1), RuntimeError("private SQL"), SimpleNamespace(data=2)]
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[]), SimpleNamespace(data=[]),
        ]
        payload = self.employee_payload(role="admin")
        with self.assertLogs("admin_users", level="WARNING") as logs:
            response = self.create_employee_request(payload)
        self.assertEqual(response.status_code, 500)
        self.assertNotIn(payload["password"], response.text + str(logs.output))
        self.assertNotIn("private SQL", response.text + str(logs.output))
        self.profile_client.auth.admin.delete_user.assert_called_once_with(self.new_employee_id)
        self.assertEqual(self.profile_client.rpc.call_args.args[1]["p_outcome"], "failed")

    def test_admin_creation_cannot_be_called_by_employee_inactive_or_anonymous(self):
        for role, status in [("employee", "active"), ("admin", "inactive")]:
            self.set_profile(role, status)
            response = self.create_employee_request(self.employee_payload(role="admin"))
            self.assertEqual(response.status_code, 403)
            self.profile_client.auth.admin.create_user.assert_not_called()
            self.profile_client.rpc.assert_not_called()
        response = self.client.post("/api/admin/users", json=self.employee_payload(role="admin"))
        self.assertEqual(response.status_code, 401)

    def test_user_stats_counts_active_profiles_without_auth_or_personal_fields(self):
        self.set_profile("admin")
        rows = {
            "a": {"role": "admin", "status": "active"},
            "b": {"role": "admin", "status": "inactive"},
            "c": {"role": "employee", "status": "active"},
            "d": {"role": "employee", "status": "active"},
        }
        with patch("admin_users.profiles_by_id", return_value=rows):
            response = self.client.get("/api/admin/users/stats", headers={"Authorization": "Bearer " + self.token()})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"admins": 1, "employees": 2})
        self.profile_client.auth.admin.list_users.assert_not_called()

    def test_user_stats_denies_employee_and_sanitizes_database_failure(self):
        self.set_profile("employee")
        with patch("admin_users.profiles_by_id") as read:
            response = self.client.get("/api/admin/users/stats", headers={"Authorization": "Bearer " + self.token()})
            self.assertEqual(response.status_code, 403)
            read.assert_not_called()
        self.set_profile("admin")
        with patch("admin_users.profiles_by_id", side_effect=RuntimeError("private profile")):
            response = self.client.get("/api/admin/users/stats", headers={"Authorization": "Bearer " + self.token()})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private profile", response.text)

    def test_role_selection_does_not_create_role_update_endpoint_or_allow_self_target(self):
        self.prepare_employee_creation()
        response = self.create_employee_request(self.employee_payload(role="admin", id=self.user_id))
        self.assertEqual(response.status_code, 422)
        self.profile_client.auth.admin.create_user.assert_not_called()

    def status_request(self, user_id, payload=None, token=None):
        return self.client.patch(
            f"/api/admin/users/{user_id}/status",
            json={"status": "inactive"} if payload is None else payload,
            headers={"Authorization": "Bearer " + (token or self.token())},
        )

    def prepare_employee_status_change(self, current_status="active", target_id=None):
        self.set_profile("admin")
        target_id = target_id or str(UUID(int=42))
        target = {
            "id": target_id, "name": "Funcion\u00e1rio de teste", "role": "employee",
            "status": current_status, "created_at": "must-not-leak",
        }
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[target]),
        ]
        self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(data=[{
            **target, "status": "inactive", "internal": "must-not-leak",
        }])
        return target_id

    def test_admin_can_deactivate_and_reactivate_an_employee(self):
        target_id = self.prepare_employee_status_change()
        response = self.status_request(target_id, {"status": "inactive"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "id": target_id, "name": "Funcion\u00e1rio de teste", "role": "employee", "status": "inactive",
        })
        self.assert_audit_rpc("audit_update_employee_status", {"p_user_id": target_id, "p_status": "inactive"})
        self.query.update.assert_not_called()
        self.assertNotIn("must-not-leak", response.text)

        target_id = self.prepare_employee_status_change(current_status="inactive")
        self.profile_client.rpc.reset_mock()
        self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(data=[{
            "id": target_id, "name": "Funcion\u00e1rio de teste", "role": "employee", "status": "active",
        }])
        response = self.status_request(target_id, {"status": "active"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "active")
        self.assert_audit_rpc("audit_update_employee_status", {"p_user_id": target_id, "p_status": "active"})

    def test_status_change_requires_admin_before_target_lookup_or_write(self):
        target_id = str(UUID(int=42))
        self.set_profile("employee")
        response = self.status_request(target_id)
        self.assertEqual(response.status_code, 403)
        self.query.update.assert_not_called()

        self.profile_client.reset_mock(return_value=True, side_effect=True)
        response = self.client.patch(f"/api/admin/users/{target_id}/status", json={"status": "inactive"})
        self.assertEqual(response.status_code, 401)
        self.profile_client.assert_not_called()

    def test_status_change_rejects_admin_targets_and_invalid_input(self):
        target_id = str(UUID(int=42))
        self.set_profile("admin")
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[{"id": target_id, "name": "Admin", "role": "admin", "status": "active"}]),
        ]
        response = self.status_request(target_id)
        self.assertEqual(response.status_code, 403)
        self.query.update.assert_not_called()

        for user_id, payload in [
            ("not-a-uuid", {"status": "inactive"}),
            (str(UUID(int=42)), {"status": "disabled"}),
            (str(UUID(int=42)), {"status": "inactive", "role": "admin"}),
            (str(UUID(int=42)), {}),
        ]:
            self.set_profile("admin")
            response = self.status_request(user_id, payload)
            with self.subTest(user_id=user_id, payload=payload):
                self.assertEqual(response.status_code, 422)
        self.query.update.assert_not_called()

    def test_status_change_returns_404_for_unknown_employee_and_sanitizes_failures(self):
        target_id = str(UUID(int=42))
        self.set_profile("admin")
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[]),
        ]
        response = self.status_request(target_id)
        self.assertEqual(response.status_code, 404)
        self.query.update.assert_not_called()

        self.prepare_employee_status_change()
        self.profile_client.rpc.return_value.execute.side_effect = RuntimeError("raw database detail")
        with self.assertLogs("admin_users", level="ERROR") as logs:
            response = self.status_request(target_id)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "N\u00e3o foi poss\u00edvel atualizar o status do funcion\u00e1rio."})
        self.assertEqual(logs.output, ["ERROR:admin_users:employee_status_update_failed"])
        self.assertNotIn("raw database detail", response.text)

    def test_inactive_employee_is_blocked_with_a_valid_jwt_and_reactivation_restores_access(self):
        self.set_profile("employee", "inactive")
        self.assertEqual(self.request(self.token()).status_code, 403)
        self.set_profile("employee", "active")
        self.assertEqual(self.request(self.token()).status_code, 200)

    def delete_employee_request(self, user_id, token=None):
        return self.client.delete(
            f"/api/admin/users/{user_id}",
            headers={"Authorization": "Bearer " + (token or self.token())},
        )

    def prepare_employee_deletion(self, status="inactive", target_id=None, confirmation_rows=None):
        self.set_profile("admin")
        self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(data=1)
        target_id = target_id or str(UUID(int=43))
        target = {
            "id": target_id, "name": "Funcion\u00e1rio inativo", "role": "employee", "status": status,
        }
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[target]),
            SimpleNamespace(data=[] if confirmation_rows is None else confirmation_rows),
        ]
        return target_id

    def test_admin_permanently_deletes_only_an_inactive_employee(self):
        target_id = self.prepare_employee_deletion()
        response = self.delete_employee_request(target_id)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b"")
        self.profile_client.auth.admin.delete_user.assert_called_once_with(target_id)
        self.query.delete.assert_not_called()
        self.assert_auth_audit("deletion", "succeeded", p_user_id=target_id)

        # Once the cascading profile deletion is visible, a still-valid JWT can
        # no longer satisfy require_active_user.
        self.result.side_effect = None
        self.result.return_value = SimpleNamespace(data=[])
        self.assertEqual(self.request(self.token()).status_code, 403)

    def test_employee_deletion_rejects_active_and_administrator_targets(self):
        target_id = self.prepare_employee_deletion(status="active")
        response = self.delete_employee_request(target_id)
        self.assertEqual(response.status_code, 409)
        self.profile_client.auth.admin.delete_user.assert_not_called()

        self.set_profile("admin")
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[{"id": self.user_id, "name": "Admin", "role": "admin", "status": "active"}]),
        ]
        response = self.delete_employee_request(self.user_id)
        self.assertEqual(response.status_code, 403)
        self.profile_client.auth.admin.delete_user.assert_not_called()

    def test_employee_deletion_requires_an_admin_and_valid_existing_uuid(self):
        target_id = str(UUID(int=43))
        self.set_profile("employee")
        response = self.delete_employee_request(target_id)
        self.assertEqual(response.status_code, 403)
        self.profile_client.auth.admin.delete_user.assert_not_called()

        self.profile_client.reset_mock(return_value=True, side_effect=True)
        response = self.client.delete(f"/api/admin/users/{target_id}")
        self.assertEqual(response.status_code, 401)
        self.profile_client.assert_not_called()

        self.query = self.profile_client.schema.return_value.table.return_value
        self.result = self.query.select.return_value.eq.return_value.limit.return_value.execute
        self.set_profile("admin")
        response = self.delete_employee_request("not-a-uuid")
        self.assertEqual(response.status_code, 422)
        self.profile_client.auth.admin.delete_user.assert_not_called()

        self.set_profile("admin")
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[]),
        ]
        response = self.delete_employee_request(target_id)
        self.assertEqual(response.status_code, 404)
        self.profile_client.auth.admin.delete_user.assert_not_called()

    def test_employee_deletion_fails_closed_for_unknown_outcome_or_missing_confirmation(self):
        target_id = self.prepare_employee_deletion()
        self.profile_client.auth.admin.delete_user.side_effect = RuntimeError("raw auth timeout")
        with self.assertLogs("admin_users", level="ERROR") as logs:
            response = self.delete_employee_request(target_id)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json(), {"detail": "N\u00e3o foi poss\u00edvel excluir o funcion\u00e1rio."})
        self.assertEqual(logs.output, ["ERROR:admin_users:employee_deletion_outcome_unknown"])
        self.assertNotIn("raw auth timeout", response.text)
        self.assert_auth_audit("deletion", "unknown", p_user_id=target_id,
                               p_stage="auth_delete", p_reason_code="remote_outcome_unknown")

        self.profile_client.reset_mock()
        self.profile_client.auth.admin.delete_user.reset_mock()
        self.profile_client.auth.admin.delete_user.side_effect = None
        target_id = self.prepare_employee_deletion(confirmation_rows=[{
            "id": target_id, "name": "Funcion\u00e1rio inativo", "role": "employee", "status": "inactive",
        }])
        with self.assertLogs("admin_users", level="ERROR") as confirmation_logs:
            response = self.delete_employee_request(target_id)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "N\u00e3o foi poss\u00edvel confirmar a exclus\u00e3o do funcion\u00e1rio."})
        self.assertEqual(confirmation_logs.output, ["ERROR:admin_users:employee_deletion_confirmation_failed"])
        self.profile_client.auth.admin.delete_user.assert_called_once_with(target_id)
        self.assert_auth_audit("deletion", "unknown", p_user_id=target_id,
                               p_stage="deletion_confirmation", p_reason_code="profile_still_present")

    def test_employee_creation_rejects_forbidden_and_invalid_input_without_echoing_password(self):
        invalid_payloads = [
            self.employee_payload(role="superadmin"),
            self.employee_payload(status="active"),
            self.employee_payload(id=self.new_employee_id if hasattr(self, "new_employee_id") else self.user_id),
            self.employee_payload(extra="not allowed"),
            self.employee_payload(p_actor_id=self.user_id),
            self.employee_payload(p_request_id=str(UUID(int=99))),
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
        self.assert_auth_audit("creation", "failed", p_stage="auth_create", p_reason_code="account_exists")

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
        self.assert_auth_audit("creation", "unknown", p_stage="auth_create", p_reason_code="remote_outcome_unknown")

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
        self.assert_auth_audit("creation", "failed", p_user_id=self.new_employee_id,
                               p_stage="profile_insert", p_reason_code="profile_write_failed",
                               p_compensation_result="succeeded")

    def test_existing_or_uncertain_profile_is_never_overwritten_or_deleted(self):
        existing = [{"id": "existing-profile", "name": "Existing", "role": "employee", "status": "active"}]
        self.prepare_employee_creation(profile_rows=existing)
        with self.assertLogs("admin_users", level="ERROR") as logs:
            response = self.create_employee_request()
        self.assertEqual(response.status_code, 500)
        self.query.insert.assert_not_called()
        self.profile_client.auth.admin.delete_user.assert_not_called()
        self.assertEqual(logs.output, ["ERROR:admin_users:employee_creation_reconciliation_required"])
        self.assert_auth_audit("creation", "unknown", p_user_id=self.new_employee_id,
                               p_stage="profile_lookup", p_reason_code="preexisting_profile")

        self.profile_client.reset_mock()
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
        self.assert_auth_audit("creation", "unknown", p_user_id=self.new_employee_id,
                               p_stage="profile_insert", p_reason_code="profile_write_outcome_unknown",
                               p_compensation_result="not_attempted")

    def test_auth_intent_must_be_confirmed_before_any_external_operation(self):
        for operation in ("creation", "deletion"):
            for unconfirmed in (None, [], True, 0):
                with self.subTest(operation=operation, unconfirmed=unconfirmed):
                    self.profile_client.reset_mock()
                    if operation == "creation":
                        self.prepare_employee_creation()
                    else:
                        target_id = self.prepare_employee_deletion()
                    self.profile_client.rpc.return_value.execute.return_value = SimpleNamespace(data=unconfirmed)
                    response = (self.create_employee_request() if operation == "creation"
                                else self.delete_employee_request(target_id))
                    self.assertEqual(response.status_code, 503)
                    self.profile_client.auth.admin.create_user.assert_not_called()
                    self.profile_client.auth.admin.delete_user.assert_not_called()
                    self.query.insert.assert_not_called()
                    self.profile_client.rpc.assert_called_once()

    def test_auth_intent_errors_preserve_authorization_and_block_external_calls(self):
        for code, expected in (("42501", 403), ("P0002", 404), ("P0001", 409), ("XX000", 503)):
            with self.subTest(code=code):
                self.profile_client.reset_mock()
                target_id = self.prepare_employee_deletion()
                self.profile_client.rpc.return_value.execute.side_effect = APIError({
                    "code": code, "message": "private audit error", "details": None, "hint": None,
                })
                response = self.delete_employee_request(target_id)
                self.assertEqual(response.status_code, expected)
                self.assertNotIn("private audit error", response.text)
                self.profile_client.auth.admin.delete_user.assert_not_called()

    def test_result_audit_failure_never_repeats_auth_or_compensates_success(self):
        for operation in ("creation", "deletion"):
            with self.subTest(operation=operation):
                self.profile_client.reset_mock()
                if operation == "creation":
                    self.prepare_employee_creation()
                else:
                    target_id = self.prepare_employee_deletion()
                self.profile_client.rpc.return_value.execute.side_effect = [
                    SimpleNamespace(data=1), RuntimeError("private result failure"),
                ]
                response = (self.create_employee_request() if operation == "creation"
                            else self.delete_employee_request(target_id))
                self.assertEqual(response.status_code, 503)
                self.assertNotIn("private result failure", response.text)
                self.assertIn("Reconcilia", response.json()["detail"])
                if operation == "creation":
                    self.profile_client.auth.admin.create_user.assert_called_once()
                    self.profile_client.auth.admin.delete_user.assert_not_called()
                    self.assert_auth_audit(operation, "succeeded", p_user_id=self.new_employee_id)
                else:
                    self.profile_client.auth.admin.delete_user.assert_called_once_with(target_id)
                    self.assert_auth_audit(operation, "succeeded", p_user_id=target_id)
                self.profile_client.rpc.return_value.execute.side_effect = None

    def test_auth_rejections_and_timeouts_have_only_confirmed_outcomes(self):
        for operation in ("creation", "deletion"):
            for status, outcome in ((400, "failed"), (408, "unknown"), (500, "unknown")):
                with self.subTest(operation=operation, status=status):
                    self.profile_client.reset_mock()
                    if operation == "creation":
                        self.prepare_employee_creation()
                        external = self.profile_client.auth.admin.create_user
                    else:
                        target_id = self.prepare_employee_deletion()
                        external = self.profile_client.auth.admin.delete_user
                    external.side_effect = AuthApiError("private provider error", status, "unexpected_failure")
                    response = (self.create_employee_request() if operation == "creation"
                                else self.delete_employee_request(target_id))
                    self.assertEqual(response.status_code, 502)
                    self.assertNotIn("private provider error", response.text)
                    external.assert_called_once()
                    self.query.insert.assert_not_called()
                    metadata = {"p_stage": "auth_create" if operation == "creation" else "auth_delete",
                                "p_reason_code": "auth_rejected" if outcome == "failed" else "remote_outcome_unknown"}
                    if operation == "deletion":
                        metadata["p_user_id"] = target_id
                    self.assert_auth_audit(operation, outcome, **metadata)
                    external.side_effect = None

    def test_uncertain_compensation_is_unknown_and_never_reported_as_failure(self):
        self.prepare_employee_creation()
        self.query.insert.return_value.execute.side_effect = RuntimeError("insert failed")
        self.result.side_effect = [
            SimpleNamespace(data=[{"id": self.user_id, "role": "admin", "status": "active"}]),
            SimpleNamespace(data=[]), SimpleNamespace(data=[]),
        ]
        self.profile_client.auth.admin.delete_user.side_effect = TimeoutError("private compensation timeout")
        response = self.create_employee_request()
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("private compensation timeout", response.text)
        self.profile_client.auth.admin.delete_user.assert_called_once_with(self.new_employee_id)
        self.assert_auth_audit("creation", "unknown", p_user_id=self.new_employee_id,
                               p_stage="compensation", p_reason_code="compensation_unconfirmed",
                               p_compensation_result="unknown")

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
