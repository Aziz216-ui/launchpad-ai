"""
Commande seed_conversation : peuple la base avec des conversations et messages.
Idempotent.
"""
from django.core.management.base import BaseCommand
from conversation.models import Conversation, Message

CONVS_SEED = [
    {
        "projet_id": 1,
        "titre": "Session de demarrage TechStart",
        "messages": [
            ("utilisateur", "Bonjour ! Je viens de creer mon projet TechStart. Par ou commencer ?"),
            ("assistant", "Bonjour ! Bienvenue sur votre espace Co-Fondateur IA. La premiere etape est de valider votre idee aupres de vrais clients."),
            ("utilisateur", "Comment trouver mes premiers clients ?"),
            ("assistant", "Pour trouver vos premiers clients : 1) LinkedIn, 2) Evenements sectoriels, 3) Groupes de votre secteur."),
        ],
    },
    {
        "projet_id": 2,
        "titre": "Session logistique GreenBox",
        "messages": [
            ("utilisateur", "Comment dimensionner ma flotte de velos ?"),
            ("assistant", "Commencez petit : 2 a 3 velos cargos sur une zone geographique restreinte."),
        ],
    },
]

class Command(BaseCommand):
    help = "Peuple les conversations et messages"

    def handle(self, *args, **options):
        self.stdout.write("Peuplement des conversations...")
        nb_conv = 0
        for data in CONVS_SEED:
            conv, created = Conversation.objects.get_or_create(
                projet_id=data["projet_id"],
                titre=data["titre"],
            )
            if created:
                nb_conv += 1
                for role, contenu in data["messages"]:
                    Message.objects.create(conversation=conv, role=role, contenu=contenu)

        self.stdout.write(self.style.SUCCESS(f"[DONE] Seed termine : {nb_conv} conversation(s) creee(s)."))

