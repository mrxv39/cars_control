import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required

from companies.services import create_company_for_user, CompanyCreationError


@csrf_exempt
@require_http_methods(["POST"])
@login_required
def create_company(request):
    """
    Create a new company for the authenticated user.
    
    POST /api/companies
    Body: {"name": "Company Name"}
    
    Returns:
        201: Company created successfully
        400: Validation error or user already owns a company
        401: Not authenticated
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse(
            {"ok": False, "error": "Invalid JSON"},
            status=400
        )
    
    name = data.get("name", "").strip()
    if not name:
        return JsonResponse(
            {"ok": False, "error": "Company name is required"},
            status=400
        )
    
    try:
        company = create_company_for_user(request.user, name)
        return JsonResponse(
            {
                "ok": True,
                "company": {
                    "id": company.id,
                    "name": company.name,
                    "slug": company.slug,
                    "status": company.status,
                    "created_at": company.created_at.isoformat(),
                }
            },
            status=201
        )
    except CompanyCreationError as e:
        return JsonResponse(
            {"ok": False, "error": str(e)},
            status=400
        )


@require_http_methods(["GET"])
@login_required
def company_status(request):
    """
    Get the company status for the authenticated user.
    
    GET /api/companies/status
    
    Returns:
        200: Company status information
        404: User has no company
    """
    from accounts.models import Membership
    
    membership = Membership.objects.select_related("company").filter(user=request.user).first()
    
    if not membership:
        return JsonResponse(
            {"ok": False, "error": "No company found for user"},
            status=404
        )
    
    company = membership.company
    return JsonResponse(
        {
            "ok": True,
            "company": {
                "id": company.id,
                "name": company.name,
                "slug": company.slug,
                "status": company.status,
                "is_active": company.is_company_active(),
                "created_at": company.created_at.isoformat(),
            },
            "role": membership.role,
        }
    )

