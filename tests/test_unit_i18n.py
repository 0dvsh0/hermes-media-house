"""
Unit tests for dashboard/i18n.py (English-only)

Tests cover:
- LANGS constant
- get_lang(): always returns "en" for English-only plugin
- t(): English lookup, format_map interpolation, missing-key fallback, optional positional lang
- String coverage: key categories present in _STRINGS
"""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi import Request

from dashboard.i18n import get_lang, LANGS, t, _STRINGS


def _make_request(headers: dict[str, str]) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "query_string": b"",
    }
    return Request(scope)


class TestLangsConstant:
    def test_langs_is_tuple(self):
        assert isinstance(LANGS, tuple)

    def test_langs_contains_en(self):
        assert "en" in LANGS

    def test_langs_length(self):
        assert len(LANGS) == 1


class TestGetLang:
    def test_always_returns_en(self):
        for header_val in ("en", "zh", "zh-CN", "auto", "fr"):
            req = _make_request({"x-media-desk-lang": header_val})
            assert get_lang(req) == "en"

    def test_absent_header_returns_en(self):
        req = _make_request({})
        assert get_lang(req) == "en"


class TestTFunction:
    def test_basic_lookup(self):
        result = t("receipt.item.added", title="Test Item")
        assert result == "Item added: Test Item"

    def test_with_legacy_lang_arg(self):
        # Even if a caller passes "zh" or "en" as a positional arg, it should work and return English
        result = t("receipt.item.added", "en", title="Test Item")
        assert result == "Item added: Test Item"
        result2 = t("receipt.item.added", "zh", title="Test Item")
        assert result2 == "Item added: Test Item"

    def test_missing_key_returns_key_itself(self):
        result = t("no.such.key")
        assert result == "no.such.key"

    def test_format_map_interpolation(self):
        result = t("receipt.item.scheduled", title="Post A")
        assert result == "Item scheduled: Post A"

    def test_format_map_missing_kwarg_returns_template(self):
        result = t("receipt.item.added")
        assert result == _STRINGS["receipt.item.added"]

    def test_no_kwargs_no_substitution(self):
        result = t("receipt.draft.saved")
        assert result == _STRINGS["receipt.draft.saved"]


class TestTCoverage:
    def test_ops_receipts_present(self):
        for key in [
            "receipt.item.added", "receipt.item.updated", "receipt.item.deleted",
            "receipt.item.scheduled", "receipt.item.unscheduled",
            "receipt.status.set", "receipt.draft.saved", "receipt.production.updated",
            "receipt.person.added", "receipt.person.updated", "receipt.person.deleted",
            "receipt.angle.added", "receipt.angle.updated", "receipt.angle.deleted",
            "receipt.style.added", "receipt.style.updated", "receipt.style.deleted",
            "receipt.style.set", "receipt.style.cleared",
            "receipt.skill.added", "receipt.skill.updated", "receipt.skill.deleted",
            "receipt.metric.added",
            "receipt.account.added", "receipt.account.updated", "receipt.account.deleted",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_ops_errors_present(self):
        for key in [
            "error.op.unknown", "error.op.missing_fields",
            "error.item.empty", "error.item.not_found",
            "error.status.invalid", "error.kind.invalid", "error.platform.invalid",
            "error.url.invalid", "error.date.invalid",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_settings_errors_present(self):
        for key in [
            "error.settings.source.invalid", "error.settings.baseUrl.invalid",
            "error.settings.extra.invalid", "error.settings.assistant.mismatch",
            "error.settings.toolSize.invalid", "error.settings.toolQuality.invalid",
            "notice.settings.saved", "notice.settings.apikey_hint",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_state_errors_present(self):
        for key in [
            "error.state.parse_failed", "error.state.migration_failed",
            "notice.state.reset",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_production_errors_present(self):
        for key in [
            "error.produce.already_running", "error.produce.plan_failed",
            "error.produce.article_failed", "error.produce.interrupted",
            "error.produce.cancelled",
            "receipt.produce.started", "receipt.produce.completed",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_image_errors_present(self):
        for key in [
            "error.image.unsupported_format", "error.image.too_large",
            "error.image.url_unresolved", "error.image.no_provider",
            "error.image.rate_limited", "error.image.timeout",
            "error.image.auth_failed", "error.image.not_found",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_ssrf_errors_present(self):
        for key in [
            "error.ssrf.blocked", "error.ssrf.private_ip",
            "error.ssrf.invalid_scheme", "error.ssrf.timeout",
            "error.ssrf.too_large", "error.ssrf.too_many_redirects",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_monid_errors_present(self):
        for key in [
            "error.monid.missing", "error.monid.no_key",
            "error.monid.unsupported_platform", "error.monid.invalid_url",
            "error.monid.redirect_limit", "error.monid.import_in_progress",
            "error.monid.cli_unavailable",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_export_errors_present(self):
        for key in [
            "error.export.missing_asset", "error.export.empty_article",
            "error.export.invalid_video_cover", "error.export.path_not_saved",
            "receipt.export.saved",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_style_errors_present(self):
        for key in [
            "error.style.text_too_short", "error.style.url_fetch_failed",
            "error.skills.none_active", "receipt.skills.learned",
            "receipt.skills.exported",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_upload_errors_present(self):
        for key in [
            "error.upload.too_large", "error.upload.unsupported_mime",
            "error.upload.invalid_filename",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_chat_notices_present(self):
        for key in [
            "notice.chat.revision_unavailable", "receipt.chat.cleared",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"

    def test_generic_errors_present(self):
        for key in [
            "error.internal", "error.forbidden", "error.request_too_large",
        ]:
            assert t(key) != key, f"Missing string for {key!r}"
