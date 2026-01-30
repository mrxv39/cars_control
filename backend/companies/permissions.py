"""
Permissions for company-based access control.
"""
from django.core.exceptions import PermissionDenied
from companies.models import Company


class CompanyNotActiveError(PermissionDenied):
    """Raised when attempting to perform operations with a non-active company."""
    
    def __init__(self, company: Company):
        self.company = company
        
        if company.status == Company.Status.PENDING:
            message = "Your company is pending approval. Please wait for admin approval before creating resources."
        elif company.status == Company.Status.REJECTED:
            message = "Your company application was rejected. Please contact support."
        elif company.status == Company.Status.SUSPENDED:
            message = "Your company is suspended. Please contact support."
        else:
            message = "Your company is not active."
        
        super().__init__(message)


def require_active_company(company: Company) -> None:
    """
    Check if company is active and raise exception if not.
    
    Args:
        company: Company instance to check
        
    Raises:
        CompanyNotActiveError: If company is not active
    """
    if not company.is_company_active():
        raise CompanyNotActiveError(company)


def get_user_company_or_none(user):
    """
    Get the company for a user, or None if user has no company.
    
    Args:
        user: User instance
        
    Returns:
        Company instance or None
    """
    from accounts.models import Membership
    
    membership = (
        Membership.objects.select_related("company")
        .filter(user=user)
        .order_by("id")
        .first()
    )
    return membership.company if membership else None
