from django.apps import AppConfig
from django.db.models.signals import post_migrate


def run_seeder_post_migrate(sender, **kwargs):
    try:
        from .seeder import seed_all_if_needed
        seed_all_if_needed()
    except Exception:
        pass


class TyperConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'typer'

    def ready(self):
        post_migrate.connect(run_seeder_post_migrate, sender=self)

