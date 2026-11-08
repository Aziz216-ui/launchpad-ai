"""
Commande seed_recommandation : peuple la base avec des recommandations pour les projets 1, 2, 3.
Idempotent.
"""
from django.core.management.base import BaseCommand
from recommandation.models import Recommandation

RECOS_SEED = [
    # Projet 1
    {"projet_id": 1, "analyse_id": 1, "categorie": "marche", "ordre": 1, "titre": "Conduire 10 entretiens prospects", "description": "Interrogez 10 directeurs techniques pour valider le besoin en freelances IA.", "priorite": "haute"},
    {"projet_id": 1, "analyse_id": 1, "categorie": "produit", "ordre": 2, "titre": "Developper le matching algorithmique", "description": "Creez la premiere version de l'algorithme de matching profils/missions.", "priorite": "haute"},
    {"projet_id": 1, "analyse_id": 1, "categorie": "financier", "ordre": 3, "titre": "Preparer le pitch deck investisseur", "description": "Deck de 10 slides pour business angels (marche, traction, equipe, besoin).", "priorite": "moyenne"},
    {"projet_id": 1, "analyse_id": 1, "categorie": "juridique", "ordre": 4, "titre": "Rediger les CGU de la marketplace", "description": "Faites valider les conditions d'utilisation et de paiement par un juriste.", "priorite": "moyenne"},
    # Projet 2
    {"projet_id": 2, "analyse_id": 2, "categorie": "marche", "ordre": 1, "titre": "Tester le service sur une premiere zone pilote", "description": "Lancez le service sur 2 arrondissements pour tester la logistique velo cargo.", "priorite": "haute"},
    {"projet_id": 2, "analyse_id": 2, "categorie": "produit", "ordre": 2, "titre": "Developper l'application livreur", "description": "Version minimale pour que les coursiers recoivent et valident les courses.", "priorite": "haute"},
    {"projet_id": 2, "analyse_id": 2, "categorie": "financier", "ordre": 3, "titre": "Calculer le cout unitaire par livraison", "description": "Mesurez le cout direct par course pour valider la marge brute unitaire.", "priorite": "haute"},
    {"projet_id": 2, "analyse_id": 2, "categorie": "juridique", "ordre": 4, "titre": "Contrats types pour les coursiers", "description": "Cadrez le statut juridique des livreurs (salaries ou prestataires).", "priorite": "moyenne"},
]

class Command(BaseCommand):
    help = "Peuple la base de donnees avec des recommandations d'exemple"

    def handle(self, *args, **options):
        self.stdout.write("Peuplement des recommandations...")
        creees = 0
        for r in RECOS_SEED:
            obj, created = Recommandation.objects.get_or_create(
                projet_id=r["projet_id"],
                titre=r["titre"],
                defaults=r,
            )
            if created:
                creees += 1

        self.stdout.write(self.style.SUCCESS(f"[DONE] Seed termine : {creees} recommandation(s) creee(s)."))

