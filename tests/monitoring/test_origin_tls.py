import importlib.util
import unittest
from pathlib import Path

path = Path(__file__).resolve().parents[2] / 'scripts' / 'monitoring' / 'origin_tls.py'
spec = importlib.util.spec_from_file_location('origin_tls', path)
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)

class ConfiguredAddressesTests(unittest.TestCase):
    def setUp(self):
        self.apex = {'name': 'thetankguide.com', 'type': 'A', 'content': '185.199.108.153'}
        self.www = {'name': 'www.thetankguide.com', 'type': 'CNAME', 'content': 'cxchajon.github.io'}
        self.allowed = ['185.199.108.153/32']

    def test_selects_configured_targets_and_deduplicates(self):
        self.assertEqual(monitor.configured_addresses([self.apex, self.apex, self.www], self.allowed), ['185.199.108.153'])

    def test_rejects_address_outside_github_ranges(self):
        self.apex['content'] = '203.0.113.4'
        with self.assertRaises(ValueError):
            monitor.configured_addresses([self.apex, self.www], self.allowed)

    def test_rejects_missing_or_unexpected_www(self):
        for records in ([self.apex], [self.apex, {**self.www, 'content': 'other.example'}]):
            with self.subTest(records=records), self.assertRaises(ValueError):
                monitor.configured_addresses(records, self.allowed)

if __name__ == '__main__':
    unittest.main()

