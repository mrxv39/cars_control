from accounts.models import Membership


def get_user_company(user):
    """
    Devuelve la Company asociada al usuario según Membership.
    Regla actual del proyecto: 1 user = 1 company
    """
    membership = Membership.objects.select_related("company").get(user=user)
    return membership.company
