"""
Validation des références vers un autre service (ids sans clé étrangère).

Une référence n'est vérifiée (appel REST) que si elle est nouvelle ou modifiée :
introuvable -> 400 {champ: [message]} ; service injoignable -> ServiceIndisponible (503).
"""

from rest_framework.exceptions import ValidationError

OBLIGATOIRE = "Ce champ est obligatoire."


def verifier_reference(attrs, instance, champ, existe, message):
    """Id unique (ex. secteur_id) : obligatoire à la création, existence vérifiée par existe(id)."""
    valeur = attrs.get(champ)
    if instance is None and valeur is None:
        raise ValidationError({champ: OBLIGATOIRE})
    modifiee = instance is None or valeur != getattr(instance, champ)
    if valeur is not None and modifiee and not existe(valeur):
        raise ValidationError({champ: message})


def verifier_liste(attrs, instance, champ, lister, message):
    """
    Liste d'ids (ex. concurrent_ids) : doublons retirés, ids nouveaux vérifiés en un appel
    lister(ids) -> [{"id": ...}, ...].
    """
    if champ not in attrs:
        return
    ids = attrs[champ] = [*dict.fromkeys(attrs[champ])]  # ordre conservé, doublons retirés
    nouveaux = set(ids).difference(getattr(instance, champ) if instance else ())
    manquants = nouveaux - {objet["id"] for objet in lister(nouveaux)}
    if manquants:
        raise ValidationError({champ: f"{message} : " + ", ".join(map(str, sorted(manquants)))})
