from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.core.exceptions import PermissionDenied
import json

from companies.models import Company
from companies.services import create_company_for_user, CompanyCreationError
from companies.permissions import CompanyNotActiveError, require_active_company
from accounts.models import Membership
from inventory.models import Vehicle
from leads.models import Lead

User = get_user_model()


class CompanyModelTests(TestCase):
    """Test Company model methods and status management."""
    
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="admin",
            email="admin@test.com",
            password="admin123",
            is_staff=True,
            is_superuser=True
        )
        self.regular_user = User.objects.create_user(
            username="user",
            email="user@test.com",
            password="user123"
        )
    
    def test_company_defaults_to_pending(self):
        """New companies should default to pending status."""
        company = Company.objects.create(
            name="Test Company",
            slug="test-company"
        )
        self.assertEqual(company.status, Company.Status.PENDING)
        self.assertFalse(company.is_company_active())
    
    def test_company_approve_method(self):
        """Test company approval sets correct fields."""
        company = Company.objects.create(
            name="Test Company",
            slug="test-company",
            status=Company.Status.PENDING
        )
        
        company.approve(self.admin_user)
        company.refresh_from_db()
        
        self.assertEqual(company.status, Company.Status.ACTIVE)
        self.assertEqual(company.approved_by, self.admin_user)
        self.assertIsNotNone(company.approved_at)
        self.assertTrue(company.is_company_active())
    
    def test_company_reject_method(self):
        """Test company rejection sets correct fields."""
        company = Company.objects.create(
            name="Test Company",
            slug="test-company",
            status=Company.Status.PENDING
        )
        
        reason = "Incomplete information"
        company.reject(self.admin_user, reason)
        company.refresh_from_db()
        
        self.assertEqual(company.status, Company.Status.REJECTED)
        self.assertEqual(company.approved_by, self.admin_user)
        self.assertIsNotNone(company.approved_at)
        self.assertEqual(company.rejection_reason, reason)
        self.assertFalse(company.is_company_active())
    
    def test_company_suspend_method(self):
        """Test company suspension."""
        company = Company.objects.create(
            name="Test Company",
            slug="test-company",
            status=Company.Status.ACTIVE
        )
        
        company.suspend()
        company.refresh_from_db()
        
        self.assertEqual(company.status, Company.Status.SUSPENDED)
        self.assertFalse(company.is_company_active())


class CompanyCreationServiceTests(TestCase):
    """Test company creation service."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@test.com",
            password="test123"
        )
    
    def test_create_company_for_user(self):
        """Test creating a company creates pending company and owner membership."""
        company = create_company_for_user(self.user, "My Company")
        
        self.assertEqual(company.name, "My Company")
        self.assertEqual(company.slug, "my-company")
        self.assertEqual(company.status, Company.Status.PENDING)
        self.assertEqual(company.created_by, self.user)
        
        # Check membership was created
        membership = Membership.objects.get(user=self.user, company=company)
        self.assertEqual(membership.role, Membership.Role.OWNER)
    
    def test_user_cannot_create_multiple_companies(self):
        """Test that a user cannot own multiple companies."""
        # Create first company
        create_company_for_user(self.user, "First Company")
        
        # Try to create second company
        with self.assertRaises(CompanyCreationError) as context:
            create_company_for_user(self.user, "Second Company")
        
        self.assertIn("already owns a company", str(context.exception))
    
    def test_slug_uniqueness(self):
        """Test that slug is made unique automatically."""
        user1 = User.objects.create_user(username="user1", password="test123")
        user2 = User.objects.create_user(username="user2", password="test123")
        
        company1 = create_company_for_user(user1, "Test Company")
        company2 = create_company_for_user(user2, "Test Company")
        
        self.assertEqual(company1.slug, "test-company")
        self.assertEqual(company2.slug, "test-company-1")


class CompanyPermissionsTests(TestCase):
    """Test company active status permission checks."""
    
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="admin",
            password="admin123",
            is_staff=True
        )
        self.user = User.objects.create_user(
            username="user",
            password="user123"
        )
    
    def test_require_active_company_pending(self):
        """Test that pending companies raise CompanyNotActiveError."""
        company = Company.objects.create(
            name="Test Company",
            slug="test-company",
            status=Company.Status.PENDING
        )
        
        with self.assertRaises(CompanyNotActiveError) as context:
            require_active_company(company)
        
        self.assertIn("pending approval", str(context.exception))
    
    def test_require_active_company_rejected(self):
        """Test that rejected companies raise CompanyNotActiveError."""
        company = Company.objects.create(
            name="Test Company",
            slug="test-company",
            status=Company.Status.REJECTED
        )
        
        with self.assertRaises(CompanyNotActiveError) as context:
            require_active_company(company)
        
        self.assertIn("rejected", str(context.exception))
    
    def test_require_active_company_suspended(self):
        """Test that suspended companies raise CompanyNotActiveError."""
        company = Company.objects.create(
            name="Test Company",
            slug="test-company",
            status=Company.Status.SUSPENDED
        )
        
        with self.assertRaises(CompanyNotActiveError) as context:
            require_active_company(company)
        
        self.assertIn("suspended", str(context.exception))
    
    def test_require_active_company_active_passes(self):
        """Test that active companies pass the check."""
        company = Company.objects.create(
            name="Test Company",
            slug="test-company",
            status=Company.Status.ACTIVE
        )
        
        # Should not raise
        require_active_company(company)


class VehicleCreationWithPendingCompanyTests(TestCase):
    """Test that vehicles cannot be created with non-active companies."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username="user",
            password="user123"
        )
        self.pending_company = Company.objects.create(
            name="Pending Company",
            slug="pending-company",
            status=Company.Status.PENDING,
            created_by=self.user
        )
        self.active_company = Company.objects.create(
            name="Active Company",
            slug="active-company",
            status=Company.Status.ACTIVE,
            created_by=self.user
        )
    
    def test_cannot_create_vehicle_with_pending_company(self):
        """Test that creating a vehicle with pending company raises error."""
        with self.assertRaises(CompanyNotActiveError):
            Vehicle.objects.create(
                company=self.pending_company,
                make="Toyota",
                model="Corolla",
                year=2020,
                price_eur=15000
            )
    
    def test_can_create_vehicle_with_active_company(self):
        """Test that creating a vehicle with active company succeeds."""
        vehicle = Vehicle.objects.create(
            company=self.active_company,
            make="Toyota",
            model="Corolla",
            year=2020,
            price_eur=15000
        )
        
        self.assertEqual(vehicle.company, self.active_company)
        self.assertEqual(vehicle.make, "Toyota")
    
    def test_bypass_check_flag_works(self):
        """Test that bypass_company_check flag allows creation."""
        vehicle = Vehicle(
            company=self.pending_company,
            make="Toyota",
            model="Corolla",
            year=2020,
            price_eur=15000
        )
        # Should not raise
        vehicle.save(bypass_company_check=True)
        self.assertEqual(vehicle.company, self.pending_company)


class LeadCreationWithPendingCompanyTests(TestCase):
    """Test that leads cannot be created with non-active companies."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username="user",
            password="user123"
        )
        self.pending_company = Company.objects.create(
            name="Pending Company",
            slug="pending-company",
            status=Company.Status.PENDING,
            created_by=self.user
        )
        self.active_company = Company.objects.create(
            name="Active Company",
            slug="active-company",
            status=Company.Status.ACTIVE,
            created_by=self.user
        )
    
    def test_cannot_create_lead_with_pending_company(self):
        """Test that creating a lead with pending company raises error."""
        with self.assertRaises(CompanyNotActiveError):
            Lead.objects.create(
                company=self.pending_company,
                name="John Doe",
                email="john@test.com"
            )
    
    def test_can_create_lead_with_active_company(self):
        """Test that creating a lead with active company succeeds."""
        lead = Lead.objects.create(
            company=self.active_company,
            name="John Doe",
            email="john@test.com"
        )
        
        self.assertEqual(lead.company, self.active_company)
        self.assertEqual(lead.name, "John Doe")


class CompanyAPITests(TestCase):
    """Test company creation API endpoint."""
    
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@test.com",
            password="test123"
        )
        self.create_url = "/api/companies"
    
    def test_create_company_requires_authentication(self):
        """Test that creating company requires authentication."""
        response = self.client.post(
            self.create_url,
            data=json.dumps({"name": "Test Company"}),
            content_type="application/json"
        )
        # Should redirect to login or return 302/401
        self.assertIn(response.status_code, [302, 401, 403])
    
    def test_create_company_success(self):
        """Test successful company creation via API."""
        self.client.login(username="testuser", password="test123")
        
        response = self.client.post(
            self.create_url,
            data=json.dumps({"name": "My New Company"}),
            content_type="application/json"
        )
        
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["ok"])
        self.assertEqual(data["company"]["name"], "My New Company")
        self.assertEqual(data["company"]["status"], "pending")
        
        # Verify in database
        company = Company.objects.get(slug="my-new-company")
        self.assertEqual(company.created_by, self.user)
    
    def test_create_company_requires_name(self):
        """Test that company name is required."""
        self.client.login(username="testuser", password="test123")
        
        response = self.client.post(
            self.create_url,
            data=json.dumps({"name": ""}),
            content_type="application/json"
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["ok"])
        self.assertIn("required", data["error"].lower())
    
    def test_create_company_duplicate_rejected(self):
        """Test that user cannot create second company."""
        self.client.login(username="testuser", password="test123")
        
        # Create first company
        self.client.post(
            self.create_url,
            data=json.dumps({"name": "First Company"}),
            content_type="application/json"
        )
        
        # Try to create second company
        response = self.client.post(
            self.create_url,
            data=json.dumps({"name": "Second Company"}),
            content_type="application/json"
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["ok"])
        self.assertIn("already owns", data["error"])


class CompanyApprovalWorkflowTests(TestCase):
    """Test end-to-end company approval workflow."""
    
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="admin",
            password="admin123",
            is_staff=True,
            is_superuser=True
        )
        self.user = User.objects.create_user(
            username="user",
            password="user123"
        )
    
    def test_full_approval_workflow(self):
        """Test complete workflow: create pending, approve, then create resources."""
        # Step 1: User creates company (pending)
        company = create_company_for_user(self.user, "Test Company")
        
        self.assertEqual(company.status, Company.Status.PENDING)
        
        # Verify membership was created automatically
        membership = Membership.objects.get(user=self.user, company=company)
        self.assertEqual(membership.role, Membership.Role.OWNER)
        
        # Step 2: User cannot create vehicle while pending
        with self.assertRaises(CompanyNotActiveError):
            Vehicle.objects.create(
                company=company,
                make="Toyota",
                model="Corolla",
                year=2020,
                price_eur=15000
            )
        
        # Step 3: Admin approves company
        company.approve(self.admin_user)
        
        self.assertEqual(company.status, Company.Status.ACTIVE)
        self.assertEqual(company.approved_by, self.admin_user)
        
        # Step 4: User can now create vehicle
        vehicle = Vehicle.objects.create(
            company=company,
            make="Toyota",
            model="Corolla",
            year=2020,
            price_eur=15000
        )
        
        self.assertEqual(vehicle.company, company)
        
        # Step 5: User can also create lead
        lead = Lead.objects.create(
            company=company,
            name="John Doe",
            email="john@test.com"
        )
        
        self.assertEqual(lead.company, company)

