"""
Logique métier de l'etude-service.

Les vues se contentent d'appeler ces fonctions : toute la logique
de calcul est regroupée ici pour être facilement testable et réutilisable.

- analyse.py     : analyse d'un projet, niveau de concurrence
- etude.py       : comparaison des prix, opportunités/menaces, potentiel, rapport d'une étude
- rapport_pdf.py : mise en forme PDF du rapport
"""

from .analyse import (  # noqa: F401
    NIVEAU_INCONNU,
    NIVEAUX,
    analyser_projet,
    arrondir,
    calculer_niveau_concurrence,
)
from .etude import (  # noqa: F401
    comparer_prix,
    concurrents_de,
    evaluer_opportunites_menaces,
    evaluer_potentiel,
    generer_rapport,
    niveau_concurrence_etude,
    tendances_de,
)
from .rapport_pdf import generer_rapport_pdf  # noqa: F401
