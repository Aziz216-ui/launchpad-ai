"""Lance les tests de market-commun : python runtests.py"""

import os
import sys

import django
from django.conf import settings
from django.test.utils import get_runner

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tests.settings")
    django.setup()
    echecs = get_runner(settings)().run_tests(["tests"])
    sys.exit(bool(echecs))
