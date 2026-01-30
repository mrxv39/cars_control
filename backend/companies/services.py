"""
Service layer for company operations.
"""
from django.db import transaction
from django.utils.text import slugify
from django.contrib.auth import get_user_model

from companies.models import Company
from accounts.models import Membership

User = get_user_model()


class CompanyCreationError(Exception):
    """Raised when company creation fails."""
    pass


def create_company_for_user(user, name: str) -> Company:
    """
    Create a new company for a user with pending status.
    
    Args:
        user: User instance who is creating the company
        name: Company name
    
    Returns:
        Company instance with status=pending
        
    Raises:
        CompanyCreationError: If user already owns a company or validation fails
    """
    # Check if user already owns a company
    existing_membership = Membership.objects.filter(
        user=user,
        role=Membership.Role.OWNER
    ).first()
    
    if existing_membership:
        raise CompanyCreationError(
            f"User already owns a company: {existing_membership.company.name}"
        )
    
    # Generate unique slug
    base_slug = slugify(name)
    slug = base_slug
    counter = 1
    while Company.objects.filter(slug=slug).exists():
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Create company and membership atomically
    with transaction.atomic():
        company = Company.objects.create(
            name=name,
            slug=slug,
            status=Company.Status.PENDING,
            created_by=user,
        )
        
        Membership.objects.create(
            user=user,
            company=company,
            role=Membership.Role.OWNER
        )
    
    return company


def approve_company(company: Company, by_user) -> None:
    """
    Approve a pending company.
    
    Args:
        company: Company instance to approve
        by_user: User instance performing the approval (should be staff/superuser)
    """
    if not by_user.is_staff:
        raise PermissionError("Only staff users can approve companies")
    
    company.approve(by_user)


def reject_company(company: Company, by_user, reason: str = "") -> None:
    """
    Reject a pending company.
    
    Args:
        company: Company instance to reject
        by_user: User instance performing the rejection (should be staff/superuser)
        reason: Optional reason for rejection
    """
    if not by_user.is_staff:
        raise PermissionError("Only staff users can reject companies")
    
    company.reject(by_user, reason)
