"""P03 data-pipeline tests. No network, no licensed Shanghai geometry."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pipeline.__main__ import run
from pipeline.build.graph import Builder, execute
from pipeline.check import check_workspace
from pipeline.core.fetch import fetch_http
from pipeline.core.source import SourceInfo
from pipeline.core.store import sha256
from pipeline.sources.synthetic import FixtureSource, registered_sources


class TestOfflinePipeline(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name) / "workspace"

    def test_only_synthetic_sources_registered(self):
        infos = [s.info for s in registered_sources()]
        self.assertEqual(len(infos), 2)
        self.assertEqual({s.reference_period for s in infos}, {"2024", "2025"})
        self.assertTrue(all(s.synthetic and s.license_status == "synthetic" for s in infos))

    def test_all_and_byte_identical_rebuild(self):
        result = run("all", workspace=self.work, offline=True)
        self.assertEqual(result["status"], "PASS")
        targets = [
            self.work / stage / name
            for stage in ("raw", "interim", "build", "reports")
            for name in sorted(p.name for p in (self.work / stage).glob("*.json"))
        ]
        before = {p.relative_to(self.work).as_posix(): sha256(p.read_bytes()) for p in targets}
        self.assertTrue(before)
        self.assertEqual(run("all", workspace=self.work, offline=True)["status"], "PASS")
        after = {p.relative_to(self.work).as_posix(): sha256(p.read_bytes()) for p in targets}
        self.assertEqual(before, after)
        for year in ("2024", "2025"):
            bundle = json.loads((self.work / "build" / f"bundle_{year}.json").read_text())
            self.assertTrue(bundle["release"]["synthetic"])
            self.assertFalse(bundle["release"]["publish_approved"])
        self.assertFalse((self.work / "web/data").exists())

    def test_all_stages_independent(self):
        self.assertEqual(run("fetch", workspace=self.work)["status"], "PASS")
        self.assertEqual(len(list((self.work / "raw").glob("synthetic_*.json"))), 2)
        self.assertEqual(run("process", workspace=self.work)["status"], "PASS")
        self.assertEqual(run("build", workspace=self.work)["status"], "PASS")
        self.assertEqual(run("check", workspace=self.work)["status"], "PASS")

    def test_process_requires_fetch(self):
        with self.assertRaises(FileNotFoundError):
            run("process", workspace=self.work)

    def test_bad_raw_checksum_fails_and_force_repairs(self):
        source = FixtureSource("2024")
        raw = source.fetch(self.work)
        raw.write_bytes(b"tampered json")
        with self.assertRaisesRegex(ValueError, "SHA256_MISMATCH"):
            source.fetch(self.work, offline=True)
        source.fetch(self.work, offline=True, force=True)
        source.process(self.work)
        self.assertIn("synthetic", source.raw(self.work).read_text())

    def test_tampered_interim_and_bundle_fail_closed(self):
        run("all", workspace=self.work)
        interim = self.work / "interim/synthetic_2024.json"
        interim.write_text('{"fake": true}', encoding="utf-8")
        self.assertEqual(check_workspace(self.work)["status"], "FAIL")
        run("process", workspace=self.work)
        run("build", workspace=self.work)
        self.assertEqual(check_workspace(self.work)["status"], "PASS")
        bundle = self.work / "build/bundle_2025.json"
        bundle.write_bytes(b"broken")
        self.assertEqual(check_workspace(self.work)["status"], "FAIL")

    def test_changed_fixture_or_corrupt_cache_does_not_silently_refresh(self):
        source = FixtureSource("2024")
        source.fetch(self.work)
        manifest = source.manifest(self.work, "raw")
        payload = json.loads(manifest.read_text())
        payload["sha256"] = "0" * 64
        manifest.write_text(json.dumps(payload), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "SHA256_MISMATCH"):
            source.fetch(self.work)
        source.fetch(self.work, force=True)

    def test_public_directory_is_forbidden(self):
        run("all", workspace=self.work)
        (self.work / "web/data").mkdir(parents=True)
        self.assertEqual(check_workspace(self.work)["status"], "FAIL")

    def test_license_unknown_rejected_even_in_online_mode(self):
        info = SourceInfo(source_id="unverified", title="Not approved", url="https://example.invalid/x",
                          publisher="Unverified", reference_period="2024",
                          native_granularity="district", license_status="unknown",
                          redistribution_allowed=None)
        with patch("urllib.request.urlopen") as opener:
            with self.assertRaisesRegex(PermissionError, "SOURCE_LICENSE_NOT_APPROVED"):
                fetch_http(info, self.work / "download.json", offline=False)
            opener.assert_not_called()

    def test_offline_blocks_approved_http_as_well(self):
        info = SourceInfo(source_id="legal-but-not-downloaded", title="test", url="https://example.invalid/x",
                          publisher="test", reference_period="2024", native_granularity="district",
                          license_status="allowed", redistribution_allowed=False)
        with self.assertRaisesRegex(PermissionError, "OFFLINE_NETWORK_REQUEST_BLOCKED"):
            fetch_http(info, self.work / "x.dat", offline=True)

    def test_synthetic_source_cannot_publish(self):
        with self.assertRaisesRegex(PermissionError, "SYNTHETIC_PUBLIC_RELEASE_FORBIDDEN"):
            FixtureSource("2024").info.assert_access(public_release=True)

    def test_build_dag_dependency_order(self):
        events: list[str] = []
        execute([
            Builder("final", ("a", "b"), "end", lambda: events.append("final")),
            Builder("middle", ("root",), "b", lambda: events.append("middle")),
            Builder("first", ("root",), "a", lambda: events.append("first")),
        ], {"root"})
        self.assertEqual(events, ["first", "middle", "final"])

    def test_build_dag_missing_dependency_and_cycle(self):
        with self.assertRaisesRegex(ValueError, "MISSING_DEPENDENCY_OR_CYCLE"):
            execute([Builder("a", ("none",), "a", lambda: None)])
        with self.assertRaisesRegex(ValueError, "MISSING_DEPENDENCY_OR_CYCLE"):
            execute([Builder("a", ("b",), "a", lambda: None),
                     Builder("b", ("a",), "b", lambda: None)])

    def test_duplicate_output_rejected(self):
        with self.assertRaisesRegex(ValueError, "DUPLICATE_BUILD_OUTPUT"):
            execute([Builder("one", (), "x", lambda: None),
                     Builder("two", (), "x", lambda: None)])


if __name__ == "__main__":
    unittest.main()
