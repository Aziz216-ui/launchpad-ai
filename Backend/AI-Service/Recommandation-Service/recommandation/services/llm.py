"""
Service LLM pour le Recommandation-Service.
Génère des recommandations via un LLM OpenAI-compatible.
Si LLM_API_KEY absent ou échec -> repli sur regles.py.
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


def generer_recommandations_llm(
    projet_data: dict,
    analyse_data: dict | None = None,
    donnees_marche: dict | None = None,
) -> list[dict] | None:
    """Génère des recommandations ordonnées via LLM avec données de marché."""
    if donnees_marche is None:
        donnees_marche = {}

    forces = analyse_data.get("forces", []) if analyse_data else []
    faiblesses = analyse_data.get("faiblesses", []) if analyse_data else []
    concurrents = donnees_marche.get("concurrents", [])
    tendances = donnees_marche.get("tendances", [])

    concurrence_info = f"{donnees_marche.get('niveau_concurrence', 'inconnu')} ({len(concurrents)} concurrents réels)"
    tendances_str = ", ".join([f"{t.get('titre')} ({t.get('impact')})" for t in tendances[:4] if isinstance(t, dict)])

    prompt = f"""Génère des recommandations pour ce projet et retourne UNIQUEMENT ce format JSON :
[
  {{"categorie": "marche|financier|juridique|produit|equipe", "ordre": 1, "titre": "...", "description": "...", "priorite": "haute|moyenne|basse"}}
]

Projet : {projet_data.get('titre', 'N/A')} | Stade : {projet_data.get('stade', 'N/A')}
Forces actuelles : {forces[:3]}
Faiblesses actuelles : {faiblesses[:3]}
Concurrence (ETUDE-SERVICE) : {concurrence_info}
Tendances marché : {tendances_str or 'non précisées'}

Génère entre 4 et 6 recommandations ordonnées (prochaines étapes concrètes et adaptées au marché)."""

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
