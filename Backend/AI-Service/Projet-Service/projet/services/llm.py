"""
Service LLM configurable (OpenAI-compatible).
Si LLM_API_KEY absent ou si le LLM echoue -> repli automatique sur regles.py.
"""
from __future__ import annotations
import json
import logging
from typing import Any
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


def analyser_projet_llm(projet, donnees_marche: dict) -> dict | None:
    """
    Analyse un projet avec le LLM. Retourne un dict avec forces/faiblesses/score/resume, ou None.
    """
    prompt = f"""Analyse ce projet entrepreneurial et retourne UNIQUEMENT ce JSON (pas d'autre texte) :
{{
  "forces": ["force1", "force2"],
  "faiblesses": ["faiblesse1", "faiblesse2"],
  "score_global": 70,
  "resume": "Synthese en 2-3 phrases."
}}

Projet : {projet.titre}
Idee : {projet.idee or 'non renseignee'}
Objectifs : {projet.objectifs or 'non renseignes'}
Secteur : {projet.secteur or 'non renseigne'}
Stade : {projet.get_stade_display()}
Public cible : {projet.public_cible or 'non renseigne'}
Budget estime : {projet.budget_estime or 'non renseigne'}
Niveau de concurrence (Market-Service) : {donnees_marche.get('niveau_concurrence', 'inconnu')}
Tendances : {donnees_marche.get('tendances', [])}"""

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

