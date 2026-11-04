"""
Service LLM configurable (OpenAI-compatible) pour Projet-Service.
Si LLM_API_KEY absent ou si le LLM échoue -> repli automatique sur regles.py.
"""
from __future__ import annotations
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_config():
    return {
        "api_key": getattr(settings, "LLM_API_KEY", ""),
        "model": getattr(settings, "LLM_MODEL", "gpt-4o-mini"),
        "base_url": getattr(settings, "LLM_BASE_URL", "https://api.openai.com/v1"),
    }


def _appel_llm(messages: list[dict], max_tokens: int = 1500) -> str | None:
    """Appel générique à l'API LLM. Retourne le contenu texte ou None."""
    cfg = _get_config()
    if not cfg["api_key"]:
        return None
    try:
        import requests
        response = requests.post(
            f"{cfg['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"},
            json={"model": cfg["model"], "messages": messages, "temperature": 0.3, "max_tokens": max_tokens},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        logger.warning("LLM indisponible : %s — repli sur les règles.", exc)
        return None


PROMPT_SYSTEME = (
    "Tu es un co-fondateur expérimenté qui conseille un entrepreneur de manière bienveillante, "
    "pratique et directe. Tu parles en français. Tu fournis des conseils concrets et actionnables. "
    "Tu connais bien les startups, le financement, le droit des sociétés et le marketing."
)


def analyser_projet_llm(projet, donnees_marche: dict) -> dict | None:
    """
    Analyse un projet avec le LLM en injectant les données de l'ETUDE-SERVICE.
    """
    concurrents = donnees_marche.get("concurrents", [])
    nb_concurrents = len(concurrents)
    etudes = donnees_marche.get("etudes", [])
    tendances = donnees_marche.get("tendances", [])
    
    # Extraire les infos d'études (taille et croissance)
    infos_etudes = []
    for e in etudes[:3]:
        info = f"{e.get('titre', 'Étude')}"
        if e.get("taux_croissance"):
            info += f" (croissance: {e.get('taux_croissance')}%)"
        if e.get("taille_marche"):
            info += f" (taille: {e.get('taille_marche')})"
        infos_etudes.append(info)

    # Extraire les tendances avec leur impact (positif/negatif/neutre)
    infos_tendances = [
        f"{t.get('titre', '')} [impact: {t.get('impact', 'neutre')}]"
        for t in tendances[:5] if isinstance(t, dict)
    ]

    prompt = f"""Analyse ce projet entrepreneurial en tenant compte des données de marché réelles.
Retourne UNIQUEMENT ce format JSON (aucun autre texte) :
{{
  "forces": ["force1", "force2"],
  "faiblesses": ["faiblesse1", "faiblesse2"],
  "score_global": 70,
  "resume": "Synthèse en 2-3 phrases."
}}

Projet : {projet.titre}
Idée : {projet.idee or 'non renseignée'}
Objectifs : {projet.objectifs or 'non renseignés'}
Secteur : {projet.secteur or 'non renseigné'}
Stade : {projet.get_stade_display()}
Public cible : {projet.public_cible or 'non renseigné'}
Budget estimé : {projet.budget_estime or 'non renseigné'}

Données Étude de Marché (ETUDE-SERVICE) :
- Niveau de concurrence : {donnees_marche.get('niveau_concurrence', 'inconnu')}
- Nombre de concurrents réels : {nb_concurrents}
- Études sectorielles : {', '.join(infos_etudes) if infos_etudes else 'aucune'}
- Tendances avec impact : {', '.join(infos_tendances) if infos_tendances else 'aucune'}"""

    messages = [{"role": "system", "content": PROMPT_SYSTEME}, {"role": "user", "content": prompt}]
    contenu = _appel_llm(messages, max_tokens=800)
    if not contenu:
        return None
    try:
        debut = contenu.find("{"); fin = contenu.rfind("}") + 1
        if debut == -1: return None
        resultat = json.loads(contenu[debut:fin])
        if not isinstance(resultat.get("forces"), list): return None
        if not isinstance(resultat.get("faiblesses"), list): return None
        if not isinstance(resultat.get("score_global"), (int, float)): return None
        return resultat
    except Exception:
        return None
