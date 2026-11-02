"""Read endpoint tests: isolated app, mocked RPC, no environment/database access."""
import copy
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from activity_logs import derive_cursor_key, router
from api_auth import AuthenticatedUser, require_active_user


class ActivityLogsTests(unittest.TestCase):
    def setUp(self):
        self.actor = AuthenticatedUser("58cb19cc-7838-4d46-9d43-6705b9e22bde", "admin")
        self.app = FastAPI()
        self.db = MagicMock()
        self.app.state.profile_client = self.db
        self.app.state.activity_cursor_key = derive_cursor_key("test-only-secret")

        def authenticated():
            if self.actor is None:
                raise HTTPException(401, "Authentication required")
            return self.actor

        self.app.dependency_overrides[require_active_user] = authenticated
        self.app.include_router(router)
        self.client = TestClient(self.app)
        self.at = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=[])

    def row(self, value, **overrides):
        return {
            "id": value, "occurred_at": self.at, "actor_id": self.actor.id,
            "actor_role": "admin", "action": "order.created", "entity_type": "order",
            "entity_id": "O1", "request_id": str(UUID(int=55)),
            "details": {"schema_version": 1, "operation": "Venda", "status": "waiting", "item_count": 1, "total": "5"},
            **overrides,
        }

    def get(self, **params):
        return self.client.get("/api/admin/activity-logs", params=params)

    def test_empty_default_page_and_rpc_context(self):
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"events": [], "next_cursor": None, "has_more": False})
        name, params = self.db.rpc.call_args.args
        self.assertEqual(name, "audit_list_activity_logs")
        self.assertEqual(params["p_actor_id"], self.actor.id)
        self.assertEqual(params["p_limit"], 50)
        self.db.table.assert_not_called()

    def test_employee_and_missing_session_denied_before_rpc(self):
        self.actor = AuthenticatedUser(self.actor.id, "employee")
        self.assertEqual(self.get().status_code, 403)
        self.actor = None
        self.assertEqual(self.get().status_code, 401)
        self.db.rpc.assert_not_called()

    def test_database_rechecks_administrator_and_sanitizes_errors(self):
        for code, expected in [("42501", 403), ("XX000", 503), ("PGRST202", 503)]:
            self.db.rpc.return_value.execute.side_effect = APIError({
                "code": code, "message": "private token", "details": "password", "hint": "secret",
            })
            self.db.rpc.reset_mock()
            with self.assertLogs("activity_logs", level="ERROR") as logs:
                response = self.get()
            self.assertEqual(response.status_code, expected)
            self.assertEqual(response.json(), {"detail": "Esta consulta exige um administrador ativo."
                if expected == 403 else "Não foi possível consultar o histórico de atividades."})
            self.assertEqual(logs.output, [f"ERROR:activity_logs:activity_logs_rpc_failed exception_class=APIError code={code}"])
            self.db.rpc.assert_called_once()
            self.db.rpc.return_value.execute.assert_called_once()
            self.assertIsNone(logs.records[0].exc_info)
            for secret in ("private token", "password", "secret"):
                self.assertNotIn(secret, response.text)
                self.assertNotIn(secret, " ".join(logs.output))

    def test_rpc_transport_failure_logs_only_class_without_retry(self):
        self.db.rpc.return_value.execute.side_effect = TimeoutError(
            f"Bearer private-token password=secret actor={self.actor.id} details=private-event")
        with self.assertLogs("activity_logs", level="ERROR") as logs:
            response = self.get()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Não foi possível consultar o histórico de atividades."})
        self.assertEqual(logs.output, ["ERROR:activity_logs:activity_logs_rpc_failed exception_class=TimeoutError code=unavailable"])
        self.assertIsNone(logs.records[0].exc_info)
        self.db.rpc.assert_called_once()
        self.db.rpc.return_value.execute.assert_called_once()

    def test_rpc_error_code_is_allowlisted_not_arbitrary_text(self):
        self.db.rpc.return_value.execute.side_effect = APIError({
            "code": "PGRST202\nBearer private-token", "message": "private-message",
            "details": "private-event", "hint": "private-credential",
        })
        with self.assertLogs("activity_logs", level="ERROR") as logs:
            response = self.get()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Não foi possível consultar o histórico de atividades."})
        self.assertEqual(logs.output, ["ERROR:activity_logs:activity_logs_rpc_failed exception_class=APIError code=unavailable"])
        self.db.rpc.return_value.execute.assert_called_once()

    def test_inactive_database_profile_denied_by_fastapi(self):
        from unittest.mock import patch
        self.app.dependency_overrides.clear()
        self.db.schema.return_value.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[{
            "id": self.actor.id, "role": "admin", "status": "inactive",
        }])
        with patch("api_auth.AuthSettings.from_environment", return_value=object()), \
             patch("api_auth.verify_token", return_value={"sub": self.actor.id}):
            response = self.client.get("/api/admin/activity-logs", headers={"Authorization": "Bearer test-only"})
        self.assertEqual(response.status_code, 403)
        self.db.rpc.assert_not_called()

    def test_limit_action_uuid_and_dates_validation(self):
        for params in [
            {"limit": 0}, {"limit": 101}, {"limit": "abc"},
            {"action": "invented"}, {"user_id": "invalid"},
            {"date_from": "2026-01-01T00:00:00"},
            {"date_from": "invalid"},
            {"date_from": "2026-02-01T00:00:00Z", "date_to": "2026-01-01T00:00:00Z"},
        ]:
            with self.subTest(params=params):
                self.assertEqual(self.get(**params).status_code, 422)
        self.db.rpc.assert_not_called()

    def test_filters_and_utc_normalization(self):
        response = self.get(user_id=self.actor.id, action="stock.adjusted", limit=100,
                            date_from="2026-01-01T00:00:00-03:00", date_to="2026-02-01T00:00:00Z")
        self.assertEqual(response.status_code, 200)
        params = self.db.rpc.call_args.args[1]
        self.assertEqual(params["p_user_id"], self.actor.id)
        self.assertEqual(params["p_action"], "stock.adjusted")
        self.assertEqual(params["p_date_from"], "2026-01-01T03:00:00.000000+00:00")

    def first_page(self):
        self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=[self.row(5), self.row(4), self.row(3)])
        response = self.get(limit=2)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([e["id"] for e in response.json()["events"]], [5, 4])
        return response.json()["next_cursor"], self.db.rpc.call_args.args[1]["p_as_of"]

    def test_tied_timestamps_keyset_has_no_duplicates_or_skips(self):
        cursor, anchor = self.first_page()
        self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=[self.row(3), self.row(2)])
        response = self.get(limit=2, cursor=cursor)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([e["id"] for e in response.json()["events"]], [3, 2])
        self.assertFalse(response.json()["has_more"])
        params = self.db.rpc.call_args.args[1]
        self.assertEqual(params["p_before_id"], 4)
        self.assertEqual(params["p_as_of"], anchor)
        self.assertIsNotNone(params["p_before_at"])

    def test_cursor_tampering_and_filter_or_actor_changes(self):
        cursor, _ = self.first_page()
        calls = self.db.rpc.call_count
        for params in [
            {"limit": 2, "cursor": "!"},
            {"limit": 2, "cursor": cursor[:-4] + "AAAA"},
            {"limit": 3, "cursor": cursor},
            {"limit": 2, "cursor": cursor, "action": "order.updated"},
            {"limit": 2, "cursor": cursor, "user_id": str(UUID(int=99))},
        ]:
            self.assertEqual(self.get(**params).status_code, 422)
        self.actor = AuthenticatedUser(str(UUID(int=77)), "admin")
        self.assertEqual(self.get(limit=2, cursor=cursor).status_code, 422)
        self.assertEqual(self.db.rpc.call_count, calls)

    def test_expired_cursor(self):
        from unittest.mock import patch
        cursor, _ = self.first_page()
        with patch("activity_logs.time.time", return_value=10**12):
            self.assertEqual(self.get(limit=2, cursor=cursor).status_code, 422)

    def test_duplicate_or_out_of_order_rpc_rows_fail_closed(self):
        for rows in [[self.row(4), self.row(4)], [self.row(3), self.row(4)]]:
            self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=rows)
            self.assertEqual(self.get().status_code, 503)
        cursor, _ = self.first_page()
        self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=[self.row(4)])
        self.assertEqual(self.get(limit=2, cursor=cursor).status_code, 503)

    def test_details_allowlists_remove_secrets_at_every_supported_level(self):
        details = {"schema_version": 1, "password": "SECRET", "changes": {
            "name": {"before": "A", "after": "B", "token": "SECRET"},
            "password": {"before": "SECRET", "after": "SECRET"},
        }}
        self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=[
            self.row(1, action="profile.name_updated", entity_type="profile", entity_id=self.actor.id, details=details)
        ])
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("SECRET", response.text)
        self.assertEqual(response.json()["events"][0]["details"], {
            "schema_version": 1, "changes": {"name": {"before": "A", "after": "B"}},
        })

    def test_auth_metadata_and_null_entity(self):
        self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=[
            self.row(1, action="employee.creation_outcome_unknown", entity_type="profile", entity_id=None,
                     details={"schema_version": 1, "stage": "auth_create", "reason_code": "remote_outcome_unknown", "error": "SECRET"})
        ])
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["events"][0]["entity_id"])
        self.assertNotIn("SECRET", response.text)

    def test_malformed_rpc_responses_and_filter_mismatches(self):
        for rows in [None, {}, [self.row(1, actor_role="superuser")],
                     [self.row(1, occurred_at="2026-01-01T00:00:00")],
                     [self.row(1, details={"schema_version": 2})]]:
            self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=rows)
            self.assertEqual(self.get().status_code, 503)
        self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=[self.row(1)])
        self.assertEqual(self.get(action="order.updated").status_code, 503)

    def test_all_fields_returned_without_mutating_database_payload(self):
        row = self.row(1)
        original = copy.deepcopy(row)
        self.db.rpc.return_value.execute.return_value = SimpleNamespace(data=[row])
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()["events"][0]), set(row))
        self.assertEqual(row, original)


if __name__ == "__main__":
    unittest.main()
