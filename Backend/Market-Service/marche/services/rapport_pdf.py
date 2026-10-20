"""
Mise en forme PDF du rapport d'étude de marché (reportlab).

Le PDF est construit à partir du dictionnaire renvoyé par generer_rapport :
le JSON et le PDF présentent donc exactement les mêmes données.
"""

from io import BytesIO
from xml.sax.saxutils import escape

from django.utils.timezone import localtime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

LIBELLES = {
    "brouillon": "Brouillon", "finalisee": "Finalisée",
    "positif": "Positif", "negatif": "Négatif", "neutre": "Neutre",
    "economique": "Économique", "aligne": "Aligné", "premium": "Premium",
    "inconnu": "Inconnu", "faible": "Faible", "moyen": "Moyen", "eleve": "Élevé", "fort": "Fort",
}

BLEU = colors.HexColor("#2f5fb3")
GRIS_CLAIR = colors.HexColor("#f2f4f8")


def _styles():
    base = getSampleStyleSheet()
    return {
        "titre": ParagraphStyle("titre", parent=base["Title"], textColor=BLEU),
        "sous_titre": ParagraphStyle("sous_titre", parent=base["Normal"], alignment=TA_CENTER,
                                     textColor=colors.grey),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], textColor=BLEU, spaceBefore=12),
        "texte": base["BodyText"],
        "cellule": ParagraphStyle("cellule", parent=base["BodyText"], fontSize=8.5, leading=10.5),
    }


def _texte(valeur):
    """Texte utilisateur échappé pour reportlab (retours à la ligne conservés)."""
    if valeur is None or valeur == "":
        return "—"
    return escape(str(valeur)).replace("\n", "<br/>")


def _nombre(valeur, suffixe=""):
    if valeur is None:
        return "—"
    return f"{valeur:,.2f}".replace(",", " ") + suffixe


def _libelle(code):
    return LIBELLES.get(code, code or "—")


def _tableau(lignes, largeurs, styles, entete=True):
    cellules = [[Paragraph(str(c), styles["cellule"]) for c in ligne] for ligne in lignes]
    table = Table(cellules, colWidths=largeurs, repeatRows=1 if entete else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    if entete:
        style += [("BACKGROUND", (0, 0), (-1, 0), GRIS_CLAIR)]
    table.setStyle(TableStyle(style))
    return table


def _liste(elements, styles):
    if not elements:
        return [Paragraph("—", styles["texte"])]
    return [Paragraph(f"• {_texte(e)}", styles["texte"]) for e in elements]


def generer_rapport_pdf(rapport):
    """Renvoie le rapport d'étude de marché au format PDF (bytes)."""
    styles = _styles()
    tampon = BytesIO()
    doc = SimpleDocTemplate(
        tampon, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        title=f"Étude de marché — {rapport['etude']['titre']}", author="LaunchPad AI",
    )
    largeur = A4[0] - 4 * cm
    etude = rapport["etude"]
    marche = rapport["marche_cible"]
    prix = rapport["comparaison_prix"]
    potentiel = rapport["potentiel_commercial"]
    h = []

    h.append(Paragraph(f"Étude de marché : {_texte(etude['titre'])}", styles["titre"]))
    h.append(Paragraph(
        f"Projet {etude['projet_id']} · Statut : {_libelle(etude['statut'])} · "
        f"Mise à jour : {localtime(etude['date_mise_a_jour']):%d/%m/%Y}", styles["sous_titre"]))
    h.append(Spacer(1, 10))

    # Conclusion en tête : c'est ce que l'entrepreneur lit en premier
    h.append(Paragraph("Potentiel commercial", styles["h2"]))
    h.append(Paragraph(
        f"<b>{_libelle(potentiel['niveau'])}</b> (score {potentiel['score']}/{potentiel['score_max']}) "
        f"· Niveau de concurrence : <b>{_libelle(rapport['niveau_concurrence'])}</b>",
        styles["texte"]))
    h += _liste(potentiel["justification"], styles)

    h.append(Paragraph("Marché cible", styles["h2"]))
    h.append(_tableau([
        ["Secteur", _texte(marche["secteur"]["nom"])],
        ["Cible", _texte(marche["cible"])],
        ["Zone géographique", _texte(marche["zone_geographique"])],
        ["Taille du marché", _nombre(marche["taille_marche"])],
        ["Croissance annuelle", _nombre(marche["taux_croissance"], " %")],
    ], [4.5 * cm, largeur - 4.5 * cm], styles, entete=False))

    h.append(Paragraph("Offre et hypothèses", styles["h2"]))
    h.append(Paragraph(f"<b>Offre :</b> {_texte(rapport['offre']['description'])}", styles["texte"]))
    h.append(Paragraph(f"<b>Prix proposé :</b> {_nombre(rapport['offre']['prix_propose'])}",
                       styles["texte"]))
    h.append(Paragraph(f"<b>Hypothèses :</b> {_texte(rapport['hypotheses'])}", styles["texte"]))

    h.append(Paragraph("Tendances", styles["h2"]))
    if rapport["tendances"]:
        h.append(_tableau(
            [["Tendance", "Impact", "Description"]] + [
                [_texte(t["titre"]), _libelle(t["impact"]), _texte(t["description"])]
                for t in rapport["tendances"]
            ], [5 * cm, 2.2 * cm, largeur - 7.2 * cm], styles))
    else:
        h.append(Paragraph("Aucune tendance associée.", styles["texte"]))

    h.append(Paragraph("Concurrents", styles["h2"]))
    if rapport["concurrents"]:
        h.append(_tableau(
            [["Concurrent", "Pays", "Prix moyen", "Part de marché", "Forces", "Faiblesses"]] + [
                [_texte(c["nom"]), _texte(c["pays"]), _nombre(c["prix_moyen"]),
                 _nombre(c["part_de_marche"], " %"), _texte(c["forces"]), _texte(c["faiblesses"])]
                for c in rapport["concurrents"]
            ], [3.1 * cm, 2 * cm, 2 * cm, 2 * cm, (largeur - 9.1 * cm) / 2,
                (largeur - 9.1 * cm) / 2], styles))
    else:
        h.append(Paragraph("Aucun concurrent identifié.", styles["texte"]))

    h.append(KeepTogether([Paragraph("Comparaison des prix", styles["h2"]), _tableau([
        ["Prix proposé", "Prix min", "Prix moyen", "Prix max", "Écart / moyenne", "Positionnement"],
        [_nombre(prix["prix_propose"]), _nombre(prix["prix_min"]), _nombre(prix["prix_moyen"]),
         _nombre(prix["prix_max"]), _nombre(prix["ecart_moyenne_pct"], " %"),
         _libelle(prix["positionnement"])],
    ], [largeur / 6] * 6, styles)]))

    titre_personas = Paragraph("Personas", styles["h2"])
    if rapport["personas"]:
        for i, p in enumerate(rapport["personas"]):
            details = " · ".join(_texte(v) for v in (p["tranche_age"], p["profession"],
                                                    p["localisation"]) if v)
            # Le titre de section reste sur la même page que le premier persona
            h.append(KeepTogether(([titre_personas] if i == 0 else []) + [
                Paragraph(f"<b>{_texte(p['nom'])}</b> {('— ' + details) if details else ''}",
                          styles["texte"]),
                _tableau([
                    ["Revenu estimé", _nombre(p["revenu_estime"])],
                    ["Besoins", _texte(p["besoins"])],
                    ["Frustrations", _texte(p["frustrations"])],
                    ["Comportement d'achat", _texte(p["comportement_achat"])],
                ], [4.5 * cm, largeur - 4.5 * cm], styles, entete=False),
            ]))
            h.append(Spacer(1, 6))
    else:
        h.append(titre_personas)
        h.append(Paragraph("Aucun persona défini.", styles["texte"]))

    om = rapport["opportunites_menaces"]
    h.append(KeepTogether([Paragraph("Opportunités et menaces", styles["h2"]), _tableau([
        ["Opportunités", "Menaces"],
        ["<br/>".join(f"• {_texte(e['description'])}" for e in om["opportunites"]) or "—",
         "<br/>".join(f"• {_texte(e['description'])}" for e in om["menaces"]) or "—"],
    ], [largeur / 2] * 2, styles)]))

    swot = rapport["swot"]
    titre_swot = "Analyse SWOT"
    if swot["source"] == "calculee":
        titre_swot += " (calculée automatiquement)"

    def bloc(cle):
        return "<br/>".join(f"• {_texte(e['description'])}" for e in swot[cle]) or "—"

    table_swot = _tableau([
        ["<b>Forces</b>", "<b>Faiblesses</b>"],
        [bloc("forces"), bloc("faiblesses")],
        ["<b>Opportunités</b>", "<b>Menaces</b>"],
        [bloc("opportunites"), bloc("menaces")],
    ], [largeur / 2] * 2, styles, entete=False)
    table_swot.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 1), colors.HexColor("#e8f5e9")),
        ("BACKGROUND", (1, 0), (1, 1), colors.HexColor("#fff3e0")),
        ("BACKGROUND", (0, 2), (0, 3), colors.HexColor("#e3f2fd")),
        ("BACKGROUND", (1, 2), (1, 3), colors.HexColor("#ffebee")),
    ]))
    h.append(KeepTogether([Paragraph(titre_swot, styles["h2"]), table_swot]))

    h.append(Paragraph("Conclusion", styles["h2"]))
    h.append(Paragraph(_texte(potentiel["conclusion"]), styles["texte"]))

    doc.build(h)
    return tampon.getvalue()
