"""
Logique métier du Market-Service.

Les vues se contentent d'appeler ces fonctions : toute la logique
de calcul est regroupée ici pour être facilement testable et réutilisable.

- analyse.py     : analyses d'un secteur et d'un projet, niveau de concurrence
- etude.py       : comparaison des prix, opportunités/menaces, SWOT, rapport d'une étude
- rapport_pdf.py : mise en forme PDF du rapport
"""

from .analyse import (  # noqa: F401
    NIVEAU_INCONNU,
    NIVEAUX,
    analyser_projet,
    analyser_secteur,
    arrondir,
    calculer_niveau_concurrence,
)
from .etude import (  # noqa: F401
    calculer_elements_swot,
    comparer_prix,
    evaluer_opportunites_menaces,
    evaluer_potentiel,
    generer_rapport,
    generer_swot,
    niveau_concurrence_etude,
)
from .rapport_pdf import generer_rapport_pdf  # noqa: F401
