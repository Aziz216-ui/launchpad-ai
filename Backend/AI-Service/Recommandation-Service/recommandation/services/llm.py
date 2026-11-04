"""
Service LLM pour le Recommandation-Service.
Genere des recommandations via un LLM OpenAI-compatible.
Si LLM_API_KEY absent ou echec -> repli sur regles.py.
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
    """Appel generique a l'API LLM. Retourne le contenu texte ou None."""
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
        logger.warning("LLM indisponible : %s — repli sur les regles.", exc)
        return None


PROMPT_SYSTEME = (
    "Tu es un co-fondateur experimente qui conseille un entrepreneur de maniere bienveillante, "
    "pratique et directe. Tu parles en francais. Tu fournis des conseils concrets et actionnables. "
    "Tu connais bien les startups, le financement, le droit des societes et le marketing."
)


def generer_recommandations_llm(
    projet_data: dict,
    analyse_data: dict | None = None,
    donnees_marche: dict | None = None,
) -> list[dict] | None:
    """Genere des recommandations ordonnees via LLM. Retourne une liste ou None."""
    if donnees_marche is None:
        donnees_marche = {}

    forces = analyse_data.get("forces", []) if analyse_data else []
    faiblesses = analyse_data.get("faiblesses", []) if analyse_data else []

    prompt = f"""Genere des recommandations pour ce projet et retourne UNIQUEMENT ce JSON :
[
  {{"categorie": "marche|financier|juridique|produit|equipe", "ordre": 1, "titre": "...", "description": "...", "priorite": "haute|moyenne|basse"}}
]

Projet : {projet_data.get('titre', 'N/A')} | Stade : {projet_data.get('stade', 'N/A')}
Forces : {forces[:3]}
Faiblesses : {faiblesses[:3]}
Concurrence : {donnees_marche.get('niveau_concurrence', 'inconnu')}
Genere entre 4 et 6 recommandations ordonnees (prochaines etapes concretes)."""

    messages = [{"role": "system", "content": PROMPT_SYSTEME}, {"role": "user", "content": prompt}]
    contenu = _appel_llm(messages, max_tokens=1000)
    if not contenu:
        return None
    try:
        debut = contenu.find("["); fin = contenu.rfind("]") + 1
        if debut == -1: return None
        recos = json.loads(contenu[debut:fin])
        if not isinstance(recos, list) or not recos: return None
        return recos
    except Exception:
        return None

