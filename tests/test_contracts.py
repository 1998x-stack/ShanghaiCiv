"""P02 semantic and structural contract tests; synthetic-only data."""
from __future__ import annotations
import copy
import json
import subprocess
import shutil
import unittest
from pathlib import Path

from pipeline.contracts import comparable, validate_bundle

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests/fixtures/synthetic"


def fixture(year="2024"):
    return json.loads((FIXTURES / f"synthetic_{year}.json").read_text(encoding="utf-8"))


class TestSemanticContracts(unittest.TestCase):
    def test_two_valid_synthetic_bundles(self):
        for year in ("2024", "2025"):
            with self.subTest(year=year):
                self.assertEqual(validate_bundle(fixture(year)), [])

    def test_reject_missing_provenance(self):
        x = fixture()
        x["metrics"][0]["source_id"] = "NOT-A-SOURCE"
        self.assertIn("METRIC_SOURCE_REF", validate_bundle(x))

    def test_reject_missing_period(self):
        x = fixture()
        x["metrics"][0]["period"] = ""
        self.assertIn("METRIC_PERIOD", validate_bundle(x))
        self.assertIn("METRIC_FIELDS", validate_bundle(x))

    def test_reject_fake_hex_measurement(self):
        x = fixture()
        x["metrics"][0]["granularity"] = "hex_cell"
        x["metrics"][0]["geography_id"] = "hex:0"
        errs = validate_bundle(x)
        self.assertIn("METRIC_HEX_OBSERVATION", errs)
        self.assertIn("METRIC_NATIVE_GRANULARITY", errs)

    def test_reject_improper_null(self):
        x = fixture()
        x["metrics"][3]["value"] = 0
        self.assertIn("METRIC_STATUS_VALUE", validate_bundle(x))

    def test_reject_invalid_geography(self):
        x = fixture()
        x["metrics"][0]["geography_id"] = "district-does-not-exist"
        self.assertIn("METRIC_GEO_REF", validate_bundle(x))

    def test_reject_missing_derived_method(self):
        x = fixture()
        x["metrics"][2]["method_id"] = None
        self.assertIn("METRIC_DERIVATION", validate_bundle(x))

    def test_reject_estimate_without_modeled_flag(self):
        x = fixture()
        x["metrics"][4]["quality_flags"] = ["synthetic_fixture"]
        self.assertIn("METRIC_ESTIMATE_FLAG", validate_bundle(x))

    def test_reject_duplicate_statistical_key(self):
        x = fixture()
        x["metrics"].append(copy.deepcopy(x["metrics"][0]))
        self.assertIn("METRIC_DUPLICATE", validate_bundle(x))

    def test_reject_overlap_over_100_percent(self):
        x = fixture()
        x["world"]["memberships"][0]["fraction"] = 0.9
        self.assertIn("MEMBERSHIP_SUM", validate_bundle(x))

    def test_reject_synthetic_publication(self):
        x = fixture()
        x["release"]["publish_approved"] = True
        errs = validate_bundle(x)
        self.assertIn("RELEASE_SYNTHETIC_PUBLISH", errs)
        self.assertIn("RELEASE_LICENSE_NOT_APPROVED", errs)
        self.assertIn("SOURCE_RELEASE", errs)

    def test_same_label_different_ids_are_allowed(self):
        x = fixture()
        self.assertEqual([r["name_zh"] for r in x["regions"]].count("示例园区"), 2)
        self.assertEqual(validate_bundle(x), [])

    def test_period_unit_and_status_comparability(self):
        a = fixture()["metrics"][0]
        b = fixture()["metrics"][1]
        self.assertTrue(comparable(a, b))
        c = copy.deepcopy(b)
        c["period"] = "2025"
        self.assertFalse(comparable(a, c))
        c = copy.deepcopy(b)
        c["unit"] = "persons_per_km2"
        self.assertFalse(comparable(a, c))
        c = copy.deepcopy(b)
        c["status"] = "unavailable"
        c["value"] = None
        self.assertFalse(comparable(a, c))

    @unittest.skipUnless(shutil.which("node"), "Node not installed")
    def test_python_js_diagnostics_same(self):
        inputs = [fixture(), fixture("2025")]
        x = fixture()
        x["metrics"][0]["source_id"] = "none"
        inputs.append(x)
        y = fixture()
        y["metrics"][0]["geography_id"] = "hex:0"
        y["metrics"][0]["granularity"] = "hex_cell"
        inputs.append(y)
        js = """
        import {validateBundle} from './web/js/contracts.mjs';
        import fs from 'node:fs';
        const items = JSON.parse(fs.readFileSync(0,'utf8'));
        console.log(JSON.stringify(items.map(validateBundle)));
        """
        result = subprocess.run(["node", "--input-type=module", "-e", js],
                                cwd=ROOT, input=json.dumps(inputs), text=True,
                                capture_output=True, check=True)
        expected = [validate_bundle(item) for item in inputs]
        self.assertEqual(json.loads(result.stdout), expected)

    def test_machine_schemas(self):
        try:
            import jsonschema
        except ImportError:
            self.skipTest("Install requirements-test.txt for JSON Schema validation")
        from referencing import Registry, Resource
        schema_dir = ROOT / "schemas"
        files = sorted(schema_dir.glob("*.schema.json"))
        registry = Registry().with_resources(
            (json.loads(path.read_text())["$id"],
             Resource.from_contents(json.loads(path.read_text()))) for path in files
        )
        bundle_schema = json.loads((schema_dir / "bundle.schema.json").read_text())
        validator = jsonschema.Draft202012Validator(bundle_schema, registry=registry)
        for year in ("2024", "2025"):
            self.assertEqual(list(validator.iter_errors(fixture(year))), [])
        invalid = fixture()
        invalid["metrics"][0]["value"] = "not a number"
        self.assertTrue(list(validator.iter_errors(invalid)))


if __name__ == "__main__":
    unittest.main()
