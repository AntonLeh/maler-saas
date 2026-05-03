import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseUrl, supabaseAnonKey } from "./lib/supabase";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AssignOrder from "./pages/AssignOrder";
import ProjectManagerDashboard from "./pages/ProjectManagerDashboard";
import PlatformOwnerDashboard from "./pages/PlatformOwnerDashboard";
import CompanyRegisterPage from "./pages/CompanyRegisterPage";
import "./App.css";
import AdminTimeEvaluation from "./components/AdminTimeEvaluation";
import GlobalSettings from "./pages/GlobalSettings";
import { generateQuotePdf } from "./lib/quotePdf";
import InvoicesPage from "./pages/InvoicesPage";
import CompanyOnboardingPage from "./pages/CompanyOnboardingPage";

const PLATFORM_OWNER_ROLE_ID = 1;
const ADMIN_ROLE_ID = 2;
const PROJECT_MANAGER_ROLE_ID = 3;
const EMPLOYEE_ROLE_ID = 4;


type AppUser = {
  id: number;
  tenant_id: number;
  role_id: number;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  password_hash?: string | null;
  phone?: string | null;
  is_active?: boolean;
  created_at?: string;
  hourly_rate: number | null;
};

type Customer = {
  id: string;
  tenant_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  notes: string | null;
  created_at?: string;
  company_name: string | null;
  discount_type?: "percent" | "amount";
  discount_value?: number | null;
  discount_note?: string | null;
};

type Order = {
  id: string;
  tenant_id: number;
  customer_id: string;
  title: string;
  description: string | null;
  status: string;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  start_date: string | null;
  end_date: string | null;
  assigned_to: number | null;
  assigned_project_manager_id: number | null;
  created_by: number;
  created_at?: string;
};

type OrderProgress = {
  id: number;
  tenant_id: number;
  order_id: string;
  user_id: number;
  status: string | null;
  note: string | null;
  created_at: string;
};

type ProgressImage = {
  id: number;
  tenant_id: number;
  progress_id: number;
  user_id: number;
  image_url: string;
  file_path: string | null;
  created_at: string;
  order_id: number;
};

type CustomerFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
  notes: string;
  company_name: string;

  discount_type: "percent" | "amount";
  discount_value: string;
  discount_note: string;
};

type OrderFormData = {
  customer_id: string;
  title: string;
  description: string;
  status: string;
  address_street: string;
  address_zip: string;
  address_city: string;
  start_date: string;
  end_date: string;
  assigned_to: string;
};

type EmployeeFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  role_id: string;
  hourly_rate: string;
};

type ProgressEntry = {
  id: number;
  tenant_id: number;
  order_id: string;
  user_id: number;
  status: string;
  note: string;
  created_at: string;
};

type TimeEntry = {
  id: number;
  tenant_id: number;
  user_id: number;
  order_id: number;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  total_break_minutes: number;
  status: string;
  created_at: string;
};

type CompanySettings = {
  id: number;
  tenant_id: number;
  invoice_prefix: string | null;
  quote_prefix: string | null;
  currency: string;
  currency_symbol: string | null;
  tax_rate_default: number;
  default_hourly_rate: number | null;
  default_internal_hourly_rate: number | null;
  default_customer_hourly_rate: number | null;
  default_material_markup: number | null;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
  updated_at: string;
  onboarding_completed: boolean;
};

type SiteVisitRoomForm = {
  temp_id: number;
  room_name: string;
  length_m: string;
  width_m: string;
  height_m: string;
  notes: string;
  paint_ceiling: boolean;
  manual_wall_area_sqm: string;
};

type SiteVisitCustomServiceForm = {
  temp_id: number;
  title: string;
  description: string;
  hours: string;
};

type SiteVisitWindowForm = {
  temp_id: number;
  room_temp_id: number | null;
  count_items: string;
  width_m: string;
  height_m: string;
  notes: string;
};

type SiteVisitDoorForm = {
  temp_id: number;
  room_temp_id: number | null;
  count_items: string;
  width_m: string;
  height_m: string;
  frame_included: boolean;
  notes: string;
};

type SiteVisitRadiatorForm = {
  temp_id: number;
  room_temp_id: number | null;
  count_items: string;
  width_m: string;
  height_m: string;
  radiator_type: string;
  notes: string;
};

type SiteVisitFormState = {
  customer_id: string;
  title: string;
  object_street: string;
  object_zip: string;
  object_city: string;
  visit_date: string;
  notes: string;
  rooms: SiteVisitRoomForm[];
  windows: SiteVisitWindowForm[];
  doors: SiteVisitDoorForm[];
  radiators: SiteVisitRadiatorForm[];
  custom_services: SiteVisitCustomServiceForm[];
};

type QuotePricingRule = {
  id: number;
  tenant_id: number;
  rule_key: string;
  label: string;
  unit: string;
  unit_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AdditionalQuotePosition = {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  unit: string;
  unit_price: number;
  is_active: boolean;
  created_at: string;
};

type QuoteDetail = {
  id: number;
  quote_number: string | null;
  title: string;
  description: string | null;
  quote_date: string | null;
  valid_until: string | null;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;

  discount_type?: "percent" | "amount";
  discount_value?: number | null;
  discount_amount?: number | null;
  subtotal_after_discount?: number | null;
  notes: string | null;
  customer_id: number;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
};

type QuoteItemDetail = {
  id: number;
  quote_id: number;
  sort_order: number;
  item_type: string;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

type QuoteListItem = {
  id: number;
  quote_number: string | null;
  title: string;
  quote_date: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  customer_id: number;
};

type OrdersFilterMode =
  | "all"
  | "new"
  | "open"
  | "finished"
  | "billed"
  | "completed"
  | "customer";

type CurrentPage =
  | "dashboard"
  | "employee-dashboard"
  | "customers-list"
  | "orders-list"
  | "employees-list"
  | "assign-order"
  | "create-customer"
  | "create-quote"
  | "edit-customer"
  | "create-order"
  | "edit-order"
  | "create-employee"
  | "edit-employee"
  | "time-evaluation"
  | "settings"
  | "create-site-visit"
  | "pricing-rules"
  | "quotes-list"
  | "quote-detail"
  | "messages"
  | "invoices-list";

export default function App() {
  const [selectedAdditionalPositionId, setSelectedAdditionalPositionId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);

  const [loadingApp, setLoadingApp] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [mobileSiteVisitMenuOpen, setMobileSiteVisitMenuOpen] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [orderAssignments, setOrderAssignments] = useState<any[]>([]);

  const [messages, setMessages] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [newMessage, setNewMessage] = useState("");
  const [messageRecipientId, setMessageRecipientId] = useState("");
  const [messageImage, setMessageImage] = useState<File | null>(null);
  const [messageRecipients, setMessageRecipients] = useState<any[]>([]);

  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [progressImages, setProgressImages] = useState<ProgressImage[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  const [additionalQuotePositions, setAdditionalQuotePositions] = useState<AdditionalQuotePosition[]>([]);
  const [loadingAdditionalQuotePositions, setLoadingAdditionalQuotePositions] = useState(false);
  const [additionalQuotePositionsMessage, setAdditionalQuotePositionsMessage] = useState("");
  const [showAcceptQuoteForm, setShowAcceptQuoteForm] = useState(false);
  const [editingValidUntil, setEditingValidUntil] = useState(false);
  const [validUntilValue, setValidUntilValue] = useState("");

  const [currentPage, setCurrentPage] = useState<CurrentPage>("dashboard");
  const [showCompanyRegister, setShowCompanyRegister] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderProgress, setOrderProgress] = useState<OrderProgress[]>([]);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [ordersFilterMode, setOrdersFilterMode] = useState<OrdersFilterMode>("all");
  const [selectedEmployeeFilterId, setSelectedEmployeeFilterId] = useState<string>("");

  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [availableSiteVisits, setAvailableSiteVisits] = useState<any[]>([]);
  const [selectedSiteVisitId, setSelectedSiteVisitId] = useState<number | null>(null);
  const [loadingSiteVisits, setLoadingSiteVisits] = useState(false);
  const [loadingSiteVisit, setLoadingSiteVisit] = useState(false);
  const [editingSiteVisitId, setEditingSiteVisitId] = useState<number | null>(null);
  const [quoteDetail, setQuoteDetail] = useState<QuoteDetail | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItemDetail[]>([]);
  const [loadingQuoteDetail, setLoadingQuoteDetail] = useState(false);
  const [quoteDetailMessage, setQuoteDetailMessage] = useState("");

  const [loginEmail, setLoginEmail] = useState("admin@test-malerfirma.de");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loadingCompanySettings, setLoadingCompanySettings] = useState(false);
  const [showCompanyOnboarding, setShowCompanyOnboarding] = useState(false);

  const [pricingRules, setPricingRules] = useState<QuotePricingRule[]>([]);
  const [loadingPricingRules, setLoadingPricingRules] = useState(false);
  const [savingPricingRules, setSavingPricingRules] = useState(false);
  const [pricingRulesMessage, setPricingRulesMessage] = useState("");

  const [customerForm, setCustomerForm] = useState<CustomerFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    street: "",
    zip: "",
    city: "",
    notes: "",
    company_name: "",

    discount_type: "percent",
    discount_value: "",
    discount_note: "",
  });

  const [orderForm, setOrderForm] = useState<OrderFormData>({
    customer_id: "",
    title: "",
    description: "",
    status: "neu",
    address_street: "",
    address_zip: "",
    address_city: "",
    start_date: "",
    end_date: "",
    assigned_to: "",
  });

  const [selectedProjectManagerId, setSelectedProjectManagerId] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const [employeeForm, setEmployeeForm] = useState<EmployeeFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    role_id: String(EMPLOYEE_ROLE_ID),
    hourly_rate: "",
  });

  const [quoteForm, setQuoteForm] = useState({
    customer_id: "",
    title: "",
    description: "",
    address_street: "",
    address_zip: "",
    address_city: "",
    quote_date: new Date().toISOString().slice(0, 10),
    valid_until: "",
    notes: "",
  });

  const [siteVisitForm, setSiteVisitForm] = useState<SiteVisitFormState>({
    customer_id: "",
    title: "",
    object_street: "",
    object_zip: "",
    object_city: "",
    visit_date: new Date().toISOString().slice(0, 10),
    notes: "",
    rooms: [
      {
        temp_id: Date.now(),
        room_name: "",
        length_m: "",
        width_m: "",
        height_m: "",
        notes: "",
        paint_ceiling: true,
        manual_wall_area_sqm: "",
      },
    ],
    windows: [],
    doors: [],
    radiators: [],
    custom_services: [],
  });

  const [roomImages, setRoomImages] = useState<
    Record<number, { file: File; previewUrl: string }[]>
  >({});

  const [savedRoomImages, setSavedRoomImages] = useState<
    Record<number, { file_path: string; file_name: string | null; signedUrl: string }[]>
  >({});

  const [openSections, setOpenSections] = useState({
    general: true,
    rooms: true,
    windows: false,
    doors: false,
    radiators: false,
    custom: false,
  });


  const [savingSiteVisit, setSavingSiteVisit] = useState(false);
  const [siteVisitMessage, setSiteVisitMessage] = useState("");
  const [createQuoteAfterSave, setCreateQuoteAfterSave] = useState(false);

  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quotesMessage, setQuotesMessage] = useState("");

  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState("");

  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);

  const [customerMessage, setCustomerMessage] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [employeeMessage, setEmployeeMessage] = useState("");

  const [customerSearch, setCustomerSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<number | null>(null);

  const isEmployee = userProfile?.role_id === EMPLOYEE_ROLE_ID;
  const isProjectManager = userProfile?.role_id === PROJECT_MANAGER_ROLE_ID;
  const isAdmin = userProfile?.role_id === ADMIN_ROLE_ID || userProfile?.role_id === PLATFORM_OWNER_ROLE_ID;
  const canAccessSiteVisit = isAdmin || isProjectManager;

  const roomsCount = siteVisitForm.rooms.length;

  const windowsCount = siteVisitForm.windows.reduce(
    (sum, window) => sum + Number(window.count_items || 0),
    0
  );

  const doorsCount = siteVisitForm.doors.reduce(
    (sum, door) => sum + Number(door.count_items || 0),
    0
  );

  const radiatorsCount = siteVisitForm.radiators.reduce(
    (sum, radiator) => sum + Number(radiator.count_items || 0),
    0
  );

  const customServicesCount = siteVisitForm.custom_services.length;

  const customServicesHours = siteVisitForm.custom_services.reduce(
    (sum, service) => sum + (Number(service.hours) || 0),
    0
  );

  const canViewCustomers = isAdmin || isProjectManager;
  const canCreateCustomers = isAdmin || isProjectManager;
  const canEditCustomers = isAdmin;
  const canDeleteCustomers = isAdmin;

  const canViewOrders = isAdmin || isProjectManager;
  const canCreateOrders = isAdmin || isProjectManager;
  const canEditOrders = isAdmin || isProjectManager;
  const canAssignOrders = isAdmin || isProjectManager;

  useEffect(() => {
    const initAuth = async () => {
      setLoadingApp(true);

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });

      setLoadingApp(false);

      return () => subscription.unsubscribe();
    };

    initAuth();
  }, []);

  useEffect(() => {
    const initData = async () => {
      if (!session?.user) {
        setUserProfile(null);
        setCustomers([]);
        setOrders([]);
        setEmployees([]);
        setInvoices([]);
        setCurrentPage("dashboard");
        setEditingCustomerId(null);
        setEditingOrderId(null);
        setEditingEmployeeId(null);
        setSelectedCustomerId(null);
        setSelectedCustomerName("");
        setOrdersFilterMode("all");
        setSelectedEmployeeFilterId("");
        setProgressEntries([]);
        setTimeEntries([]);
        return;
      }

      setLoadingData(true);

      const profile = await loadUserProfile(session.user.id);

      if (!profile) {
        setCustomers([]);
        setOrders([]);
        setInvoices([]);
        setEmployees([]);
        setProgressEntries([]);
        setTimeEntries([]);
        setCurrentPage("dashboard");
        setLoadingData(false);
        return;
      }

      if (profile.role_id === EMPLOYEE_ROLE_ID) {
        setCustomers([]);
        setEmployees([]);
        setInvoices([]);
        setEditingCustomerId(null);
        setEditingOrderId(null);
        setEditingEmployeeId(null);
        setSelectedCustomerId(null);
        setSelectedCustomerName("");
        setOrdersFilterMode("all");
        setSelectedEmployeeFilterId("");

        await Promise.all([
          loadEmployeeOrders(profile.tenant_id, profile.id),
          loadEmployeeProgressEntries(profile.tenant_id, profile.id),
        ]);

        setCurrentPage("employee-dashboard");
        setLoadingData(false);
        return;
      }

      await Promise.all([
  loadCustomers(profile.tenant_id),
  loadOrders(profile.tenant_id),
  loadInvoices(profile.tenant_id),
  loadEmployees(profile.tenant_id),
  loadProgressEntries(profile.tenant_id),
]);

      setCurrentPage("dashboard");
      setLoadingData(false);
    };

    initData();
  }, [session]);

  const resetCustomerForm = () => {
    setCustomerForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      street: "",
      zip: "",
      city: "",
      notes: "",
      company_name: "",

      discount_type: "percent",
      discount_value: "",
      discount_note: "",
    });
  };

  const resetOrderForm = () => {
    setOrderForm({
      customer_id: "",
      title: "",
      description: "",
      status: "neu",
      address_street: "",
      address_zip: "",
      address_city: "",
      start_date: "",
      end_date: "",
      assigned_to: "",
    });
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      role_id: String(EMPLOYEE_ROLE_ID),
      hourly_rate: "",
    });
  };

  const loadUserProfile = async (authUserId: string): Promise<AppUser | null> => {
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error) {
      console.error("Fehler beim Laden des Benutzerprofils:", JSON.stringify(error, null, 2));
      setUserProfile(null);
      return null;
    }

    if (!data) {
      console.warn("Kein Benutzerprofil gefunden für auth_user_id:", authUserId);
      setUserProfile(null);
      return null;
    }

    setUserProfile(data as AppUser);
    return data as AppUser;
  };

  const loadCustomers = async (tenantId: number) => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("last_name", { ascending: true });

    if (error) {
      console.error("Fehler beim Laden der Kunden:", error);
      setCustomers([]);
      return;
    }

    setCustomers(data || []);
  };

  const loadQuotes = async (tenantId: number) => {
    try {
      setLoadingQuotes(true);
      setQuotesMessage("");

      const { data, error } = await supabase
        .from("quotes")
        .select(`
        id,
        quote_number,
        title,
        quote_date,
        status,
        subtotal,
        tax_amount,
        total_amount,
        customer_id
      `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setQuotes((data as QuoteListItem[]) || []);
    } catch (error: any) {
      console.error("Fehler beim Laden der Angebote:", error);
      setQuotesMessage(error?.message || "Angebote konnten nicht geladen werden.");
    } finally {
      setLoadingQuotes(false);
    }
  };

  const loadAdditionalQuotePositions = async (tenantId: number) => {
  try {
    setLoadingAdditionalQuotePositions(true);
    setAdditionalQuotePositionsMessage("");

    const { data, error } = await supabase
      .from("additional_quote_positions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("title", { ascending: true });

    if (error) {
      throw error;
    }

    setAdditionalQuotePositions(data || []);
  } catch (error: any) {
    console.error("Fehler beim Laden der Zusatzpositionen:", error);
    setAdditionalQuotePositionsMessage(
      error?.message || "Zusatzpositionen konnten nicht geladen werden."
    );
  } finally {
    setLoadingAdditionalQuotePositions(false);
  }
};

  const loadQuoteDetail = async (quoteId: number, tenantId: number) => {
    try {
      setLoadingQuoteDetail(true);
      setQuoteDetailMessage("");

      await loadAdditionalQuotePositions(tenantId);

      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .select(`
        id,
        quote_number,
        title,
        description,
        quote_date,
        valid_until,
        status,
        subtotal,
        discount_type,
        discount_value,
        discount_amount,
        subtotal_after_discount,
        tax_rate,
        tax_amount,
        total_amount,
        notes,
        customer_id,
        address_street,
        address_zip,
        address_city
      `)
        .eq("id", quoteId)
        .eq("tenant_id", tenantId)
        .single();

      if (quoteError) {
        throw quoteError;
      }

      const openQuoteDetail = async (quoteId: number) => {
        if (!userProfile?.tenant_id) return;

        setSelectedQuoteId(quoteId);
        await loadQuoteDetail(quoteId, userProfile.tenant_id);
        await loadAdditionalQuotePositions(userProfile.tenant_id);
        setCurrentPage("quote-detail");
      };

      const { data: itemsData, error: itemsError } = await supabase
        .from("quote_items")
        .select(`
        id,
        quote_id,
        sort_order,
        item_type,
        title,
        description,
        quantity,
        unit,
        unit_price,
        line_total
      `)
        .eq("quote_id", quoteId)
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        throw itemsError;
      }

      setQuoteDetail(quoteData as QuoteDetail);
      setQuoteItems((itemsData as QuoteItemDetail[]) || []);
    } catch (error: any) {
      console.error("Fehler beim Laden der Angebotsdetails:", error);
      setQuoteDetailMessage(
        error?.message || "Angebotsdetails konnten nicht geladen werden."
      );
      setQuoteDetail(null);
      setQuoteItems([]);
    } finally {
      setLoadingQuoteDetail(false);
    }
  };

const handleSaveValidUntil = async () => {
  if (!quoteDetail || !userProfile?.tenant_id) return;

  const { error } = await supabase
    .from("quotes")
    .update({
      valid_until: validUntilValue || null,
    })
    .eq("id", quoteDetail.id)
    .eq("tenant_id", userProfile.tenant_id);

  if (error) {
    setQuoteDetailMessage(error.message);
    return;
  }

  await loadQuoteDetail(quoteDetail.id, userProfile.tenant_id);
  setEditingValidUntil(false);
};

  const handleAddAdditionalPositionToQuote = async () => {
  if (!quoteDetail || !selectedAdditionalPositionId || !userProfile?.tenant_id) {
    return;
  }

  const position = additionalQuotePositions.find(
    (item) => String(item.id) === selectedAdditionalPositionId
  );

  if (!position) return;

  const nextSortOrder =
    quoteItems.length > 0
      ? Math.max(...quoteItems.map((item) => Number(item.sort_order || 0))) + 1
      : 1;

  const { error } = await supabase.from("quote_items").insert({
    tenant_id: userProfile.tenant_id,
    quote_id: quoteDetail.id,
    sort_order: nextSortOrder,
    item_type: "additional",
    title: position.title,
    description: position.description,
    quantity: 1,
    unit: position.unit,
    unit_price: position.unit_price,
  });

  if (error) {
    setQuoteDetailMessage(`Zusatzposition konnte nicht hinzugefügt werden: ${error.message}`);
    return;
  }

  await supabase.rpc("refresh_quote_totals", {
    p_quote_id: quoteDetail.id,
  });

  setSelectedAdditionalPositionId("");
  await loadQuoteDetail(quoteDetail.id, userProfile.tenant_id);
};

const handleAcceptQuote = async () => {
  if (!quoteDetail || !userProfile?.tenant_id) {
    return;
  }

  if (!selectedProjectManagerId) {
    setQuoteDetailMessage("Bitte zuerst einen Projektleiter auswählen.");
    return;
  }

  if (selectedEmployeeIds.length === 0) {
    setQuoteDetailMessage("Bitte mindestens einen Mitarbeiter auswählen.");
    return;
  }

  try {
    setQuoteDetailMessage("");

    const now = new Date().toISOString();

    const { error: quoteError } = await supabase
      .from("quotes")
      .update({
        status: "accepted",
        accepted_at: now,
      })
      .eq("id", quoteDetail.id)
      .eq("tenant_id", userProfile.tenant_id);

    if (quoteError) {
      throw quoteError;
    }

    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        tenant_id: userProfile.tenant_id,
        customer_id: quoteDetail.customer_id,
        title:
          quoteDetail.title ||
          `Auftrag aus Angebot ${quoteDetail.quote_number || quoteDetail.id}`,
        description: quoteDetail.description || quoteDetail.notes || "",
        status: "neu",
        priority: "normal",
        address_street: quoteDetail.address_street || "",
        address_zip: quoteDetail.address_zip || "",
        address_city: quoteDetail.address_city || "",
        created_by: userProfile.id,
        assigned_project_manager_id: Number(selectedProjectManagerId),
        quote_id: quoteDetail.id,
        accepted_quote_total: Number(quoteDetail.total_amount || 0),
        accepted_at: now,
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    const assignments = [
      {
        tenant_id: userProfile.tenant_id,
        order_id: newOrder.id,
        user_id: Number(selectedProjectManagerId),
        assignment_role: "project_manager",
      },
      ...selectedEmployeeIds.map((employeeId) => ({
        tenant_id: userProfile.tenant_id,
        order_id: newOrder.id,
        user_id: Number(employeeId),
        assignment_role: "employee",
      })),
    ];

    const { error: assignmentError } = await supabase
      .from("order_assignments")
      .insert(assignments);

    if (assignmentError) {
      throw assignmentError;
    }

    setQuoteDetailMessage("Angebot wurde bestätigt und ein Auftrag wurde erzeugt.");

    setShowAcceptQuoteForm(false);
    setSelectedProjectManagerId("");
    setSelectedEmployeeIds([]);

    await loadQuoteDetail(quoteDetail.id, userProfile.tenant_id);
    await loadOrders(userProfile.tenant_id);

    setCurrentPage("orders-list");

  } catch (error: any) {
    console.error("Fehler beim Bestätigen des Angebots:", error);
    setQuoteDetailMessage(
      error?.message || "Das Angebot konnte nicht bestätigt werden."
    );
  }
};

  const loadOrders = async (tenantId: number) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Aufträge:", error);
    setOrders([]);
    setOrderAssignments([]);
    return;
  }

  setOrders(data || []);

  const orderIds = (data || []).map((order) => order.id);

  if (orderIds.length === 0) {
    setOrderAssignments([]);
    return;
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("order_assignments")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("order_id", orderIds);

  if (assignmentError) {
    console.error("Fehler beim Laden der Zuweisungen:", assignmentError);
    setOrderAssignments([]);
    return;
  }

  setOrderAssignments(assignments || []);
};

  const loadInvoices = async (tenantId: number) => {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("invoice_date", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Rechnungen:", error);
    setInvoices([]);
    return;
  }

  setInvoices(data || []);
};

  const loadOrderProgress = async (
  orderId: string,
  tenantId: number
) => {
  const { data, error } = await supabase
    .from("order_progress")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden des Auftragsverlaufs:", error);
    setOrderProgress([]);
    return;
  }

  setOrderProgress((data as OrderProgress[]) || []);
};

const loadMessages = async (tenantId: number) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Nachrichten:", error);
    setMessages([]);
    return;
  }

  const loadedMessages = data || [];

setMessages(loadedMessages);

const unread = loadedMessages.filter((msg) => {
  if (!userProfile) return false;

  const isOwn = Number(msg.sender_id) === Number(userProfile.id);

  if (isOwn) return false;

  const isForMe =
    msg.recipient_id === null ||
    Number(msg.recipient_id) === Number(userProfile.id);

  return isForMe && !msg.read_at;
}).length;

setUnreadMessages(unread);
};

const handleSendMessage = async () => {
  if (!userProfile) return;

  const cleanMessage = newMessage.trim();

  if (!cleanMessage && !messageImage) return;

  let imageUrl: string | null = null;

  if (messageImage) {
    const fileExt = messageImage.name.split(".").pop();
    const fileName = `${userProfile.tenant_id}/${userProfile.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("message-images")
      .upload(fileName, messageImage);

    if (uploadError) {
      console.error("Fehler beim Hochladen des Bildes:", uploadError);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("message-images")
      .getPublicUrl(fileName);

    imageUrl = publicUrlData.publicUrl;
  }

  const { error } = await supabase
    .from("messages")
    .insert([
      {
        tenant_id: userProfile.tenant_id,
        sender_id: userProfile.id,
        recipient_id: messageRecipientId ? Number(messageRecipientId) : null,
        order_id: null,
        message_type: messageRecipientId ? "direct" : "broadcast",
        message: cleanMessage || "Bildnachricht",
        image_url: imageUrl,
      },
    ]);

  if (error) {
    console.error("Fehler beim Senden:", error);
    return;
  }

  setNewMessage("");
  setMessageRecipientId("");
  setMessageImage(null);

  await loadMessages(userProfile.tenant_id);
};

const handleDeleteMessage = async (messageId: number) => {
  if (!userProfile) return;

  const confirmDelete = window.confirm(
    "Möchtest du diese Nachricht wirklich löschen?"
  );

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("tenant_id", userProfile.tenant_id);

  if (error) {
    console.error("Fehler beim Löschen der Nachricht:", error);
    return;
  }

  await loadMessages(userProfile.tenant_id);
};

const loadMessageRecipients = async () => {
  const { data, error } = await supabase.rpc("get_message_recipients");

  if (error) {
    console.error("Fehler beim Laden der Empfänger:", error);
    setMessageRecipients([]);
    return;
  }

  setMessageRecipients(data || []);
};

  const loadEmployees = async (tenantId: number) => {
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("role_id", [ADMIN_ROLE_ID, PROJECT_MANAGER_ROLE_ID, EMPLOYEE_ROLE_ID])
      .order("last_name", { ascending: true });

    if (error) {
      console.error("Fehler beim Laden der Mitarbeiter/Projektleiter:", error);
      setEmployees([]);
      return;
    }

    setEmployees(data || []);
  };

  const loadEmployeeOrders = async (tenantId: number, employeeId: number) => {
  const { data: assignments, error: assignmentError } = await supabase
    .from("order_assignments")
    .select("order_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", employeeId)
    .eq("assignment_role", "employee");

  if (assignmentError) {
    console.error("Fehler beim Laden der Mitarbeiter-Zuweisungen:", assignmentError);
    setOrders([]);
    return;
  }

  const orderIds = (assignments || []).map((item) => item.order_id);

  if (orderIds.length === 0) {
    setOrders([]);
    return;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("id", orderIds)
    .not("status", "in", '("fertig","abgerechnet")')
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Mitarbeiter-Aufträge:", error);
    setOrders([]);
    return;
  }

  setOrders(data || []);
};

  const loadEmployeeProgressEntries = async (
  tenantId: number,
  employeeId: number
) => {
  const { data, error } = await supabase
    .from("order_progress")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("user_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Fortschritte:", error);
    setProgressEntries([]);
    setProgressImages([]);
    return;
  }

  setProgressEntries(data || []);

  const progressIds = (data || []).map((entry) => entry.id);

  if (progressIds.length === 0) {
    setProgressImages([]);
    return;
  }

  const { data: imageData, error: imageError } = await supabase
    .from("order_progress_images")
    .select("*")
    .in("progress_id", progressIds)
    .order("created_at", { ascending: false });

  if (imageError) {
    console.error("Fehler beim Laden der Fortschrittsbilder:", imageError);
    setProgressImages([]);
    return;
  }

  setProgressImages((imageData as ProgressImage[]) || []);
};

  const loadCompanySettings = async (tenantId: number) => {
    try {
      setLoadingCompanySettings(true);

      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const settings = (data as CompanySettings | null) || null;

setCompanySettings(settings);

if (
  settings &&
  settings.onboarding_completed === false &&
  userProfile?.role_id === 2
) {
  setShowCompanyOnboarding(true);
}
    } catch (error) {
      console.error("Fehler beim Laden der company_settings:", error);
      setCompanySettings(null);
    } finally {
      setLoadingCompanySettings(false);
    }
  };

  const loadPricingRules = async (tenantId: number) => {
    try {
      setLoadingPricingRules(true);
      setPricingRulesMessage("");

      const { data, error } = await supabase
        .from("quote_pricing_rules")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("label", { ascending: true });

      if (error) {
        throw error;
      }

      setPricingRules((data as QuotePricingRule[]) || []);
    } catch (error: any) {
      console.error("Fehler beim Laden der Preisregeln:", error);
      setPricingRulesMessage(
        error?.message || "Preisregeln konnten nicht geladen werden."
      );
    } finally {
      setLoadingPricingRules(false);
    }
  };

  const updatePricingRuleValue = (id: number, value: string) => {
    setPricingRules((prev) =>
      prev.map((rule) =>
        rule.id === id
          ? { ...rule, unit_price: Number(value || 0) }
          : rule
      )
    );
  };

  const savePricingRules = async () => {
    if (!userProfile?.tenant_id) {
      setPricingRulesMessage("Tenant nicht gefunden.");
      return;
    }

    try {
      setSavingPricingRules(true);
      setPricingRulesMessage("");

      for (const rule of pricingRules) {
        const { error } = await supabase
          .from("quote_pricing_rules")
          .update({
            unit_price: Number(rule.unit_price || 0),
          })
          .eq("id", rule.id)
          .eq("tenant_id", userProfile.tenant_id);

        if (error) {
          throw error;
        }
      }

      setPricingRulesMessage("Preisregeln erfolgreich gespeichert.");
      loadPricingRules(userProfile.tenant_id);
    } catch (error: any) {
      console.error("Fehler beim Speichern der Preisregeln:", error);
      setPricingRulesMessage(
        error?.message || "Preisregeln konnten nicht gespeichert werden."
      );
    } finally {
      setSavingPricingRules(false);
    }
  };

  const loadProgressEntries = async (tenantId: number) => {
    const { data, error } = await supabase
      .from("order_progress")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fehler beim Laden aller Fortschritte:", error);
      setProgressEntries([]);
      return;
    }

    setProgressEntries(data || []);
  };

  const loadEmployeeTimeEntries = async (tenantId: number, userId: number) => {
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fehler beim Laden der Zeiteinträge:", error);
      setTimeEntries([]);
      return;
    }

    setTimeEntries(data || []);
  };

  useEffect(() => {
    if (!userProfile) return;

    if (userProfile.tenant_id) {
      loadCompanySettings(userProfile.tenant_id);
      loadPricingRules(userProfile.tenant_id);
      loadQuotes(userProfile.tenant_id);
      loadMessages(userProfile.tenant_id);
      loadMessageRecipients();
}

    const isEmployee = userProfile.role_id === EMPLOYEE_ROLE_ID;

if (!isEmployee) return;

loadEmployees(userProfile.tenant_id);
loadEmployeeOrders(userProfile.tenant_id, userProfile.id);
loadEmployeeProgressEntries(userProfile.tenant_id, userProfile.id);
loadEmployeeTimeEntries(userProfile.tenant_id, userProfile.id);
}, [userProfile]);


  const handleEmployeeUpdateOrderStatus = async (
    orderId: string,
    newStatus: string
  ) => {
    if (!userProfile) {
      throw new Error("Benutzerprofil nicht geladen.");
    }

    console.log("USER:", userProfile.id);
    console.log("ORDER:", orderId);

    const allowedStatuses = ["in_arbeit", "pausiert", "zur_pruefung"];

    if (!allowedStatuses.includes(newStatus)) {
      throw new Error("Dieser Status ist für Mitarbeiter nicht erlaubt.");
    }

    console.log("RPC Aufruf:", { orderId, newStatus, userId: userProfile.id });

    const { data, error } = await supabase.rpc("employee_update_order_status", {
      p_order_id: orderId,
      p_new_status: newStatus,
    });

    console.log("RPC Antwort:", { data, error });

    if (error) {
      console.error("Fehler beim Aktualisieren des Auftragsstatus:", error);
      throw new Error(error.message || "Status konnte nicht aktualisiert werden.");
    }

    const updatedRow = Array.isArray(data) ? data[0] : null;

    if (!updatedRow) {
      throw new Error("Kein aktualisierter Auftrag wurde zurückgegeben.");
    }

    setOrders((prev) =>
      prev.map((order) =>
        String(order.id) === String(orderId)
          ? { ...order, status: updatedRow.updated_status }
          : order
      )
    );

    await loadEmployeeOrders(userProfile.tenant_id, userProfile.id);
  };

  const handleApproveOrder = async (orderId: string | number) => {
  if (!userProfile) return;

  const { error } = await supabase
    .from("orders")
    .update({ status: "fertig" })
    .eq("id", orderId)
    .eq("tenant_id", userProfile.tenant_id);

  if (error) {
    console.error("Fehler beim Freigeben:", error);
    setOrderMessage(`Freigabe fehlgeschlagen: ${error.message}`);
    return;
  }

  setOrderMessage("Auftrag wurde freigegeben und abgeschlossen.");
  await loadOrders(userProfile.tenant_id);
};

  const formatDateOnly = (value: string | null) => {
    if (!value) return "-";

    const parts = value.split("-");
    if (parts.length !== 3) return value;

    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  };

  const handleCreateProgress = async (orderId: string, note: string) => {
  if (!userProfile) {
    throw new Error("Benutzerprofil nicht geladen.");
  }

  const cleanNote = note.trim();

  if (!cleanNote) {
    throw new Error("Bitte eine Notiz eingeben.");
  }

  const currentOrder = orders.find((order) => order.id === orderId);

  if (!currentOrder) {
    throw new Error("Auftrag nicht gefunden.");
  }

  const { data, error } = await supabase
    .from("order_progress")
    .insert([
      {
        tenant_id: userProfile.tenant_id,
        order_id: orderId,
        user_id: userProfile.id,
        status: currentOrder.status,
        note: cleanNote,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Speichern des Fortschritts:", error);
    throw new Error("Fortschritt konnte nicht gespeichert werden.");
  }

  await loadEmployeeProgressEntries(userProfile.tenant_id, userProfile.id);

  return data;
};

const handleCreateInvoice = async (orderId: string | number) => {
  if (!userProfile) return;

  const confirmCreate = window.confirm(
    "Möchtest du für diesen fertigen Auftrag jetzt eine Rechnung erstellen?"
  );

  if (!confirmCreate) return;

  const { data, error } = await supabase.rpc("create_invoice_from_order", {
    p_order_id: Number(orderId),
  });

  if (error) {
    console.error("Fehler beim Erstellen der Rechnung:", error);
    setOrderMessage(`Rechnung konnte nicht erstellt werden: ${error.message}`);
    return;
  }

  const { error: orderUpdateError } = await supabase
    .from("orders")
    .update({ status: "abgerechnet" })
    .eq("id", orderId)
    .eq("tenant_id", userProfile.tenant_id);

  if (orderUpdateError) {
    console.error("Fehler beim Aktualisieren des Auftrags:", orderUpdateError);
    setOrderMessage(
      `Rechnung wurde erstellt, aber der Auftrag konnte nicht auf abgerechnet gesetzt werden: ${orderUpdateError.message}`
    );
    return;
  }

  setOrderMessage(`Rechnung wurde erstellt. Rechnungs-ID: ${data}`);
  await loadOrders(userProfile.tenant_id);
};

const handleDeleteProgressImage = async (
  imageId: number,
  filePath: string | null
) => {
  if (!userProfile) {
    throw new Error("Benutzerprofil nicht geladen.");
  }

  if (filePath) {
    const { error: storageError } = await supabase.storage
      .from("order-progress-images")
      .remove([filePath]);

    if (storageError) {
      console.error("Fehler beim Löschen des Bildes aus Storage:", storageError);
      throw new Error("Bilddatei konnte nicht gelöscht werden.");
    }
  }

  const { error } = await supabase
    .from("order_progress_images")
    .delete()
    .eq("id", imageId)
    .eq("tenant_id", userProfile.tenant_id);

  if (error) {
    console.error("Fehler beim Löschen des Bild-Datensatzes:", error);
    throw new Error("Bild konnte nicht gelöscht werden.");
  }

  await loadEmployeeProgressEntries(userProfile.tenant_id, userProfile.id);
};

  const handleEmployeeStartWork = async (orderId: string) => {
    if (!userProfile) {
      throw new Error("Benutzerprofil nicht geladen.");
    }

    const { error } = await supabase.rpc("employee_start_work", {
      p_order_id: Number(orderId),
    });

    if (error) {
      console.error("Fehler beim Starten der Arbeit:", error);
      throw new Error(error.message || "Arbeitsbeginn konnte nicht gespeichert werden.");
    }

    await loadEmployeeTimeEntries(userProfile.tenant_id, userProfile.id);
  };

  const handleEmployeeStartBreak = async (timeEntryId: number) => {
    if (!userProfile) {
      throw new Error("Benutzerprofil nicht geladen.");
    }

    const { error } = await supabase.rpc("employee_start_break", {
      p_time_entry_id: timeEntryId,
    });

    if (error) {
      console.error("Fehler beim Starten der Pause:", error);
      throw new Error(error.message || "Pause konnte nicht gestartet werden.");
    }

    await loadEmployeeTimeEntries(userProfile.tenant_id, userProfile.id);
  };

  const handleEmployeeEndBreak = async (timeEntryId: number) => {
    if (!userProfile) {
      throw new Error("Benutzerprofil nicht geladen.");
    }

    const { error } = await supabase.rpc("employee_end_break", {
      p_time_entry_id: timeEntryId,
    });

    if (error) {
      console.error("Fehler beim Beenden der Pause:", error);
      throw new Error(error.message || "Pause konnte nicht beendet werden.");
    }

    await loadEmployeeTimeEntries(userProfile.tenant_id, userProfile.id);
  };

  const handleEmployeeEndWork = async (timeEntryId: number) => {
    if (!userProfile) {
      throw new Error("Benutzerprofil nicht geladen.");
    }

    const { error } = await supabase.rpc("employee_end_work", {
      p_time_entry_id: timeEntryId,
    });

    if (error) {
      console.error("Fehler beim Beenden der Arbeit:", error);
      throw new Error(error.message || "Arbeit konnte nicht beendet werden.");
    }

    await Promise.all([
      loadEmployeeTimeEntries(userProfile.tenant_id, userProfile.id),
      loadEmployeeOrders(userProfile.tenant_id, userProfile.id),
    ]);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });

    if (error) {
      setLoginMessage(`Login fehlgeschlagen: ${error.message}`);
      return;
    }

    setLoginMessage("Login erfolgreich.");
    setLoginPassword("");
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Fehler beim Logout:", error);
      return;
    }

    setUserProfile(null);
    setCustomers([]);
    setOrders([]);
    setEmployees([]);
    setTimeEntries([]);
    setCurrentPage("dashboard");
    setEditingCustomerId(null);
    setEditingOrderId(null);
    setEditingEmployeeId(null);
    setSelectedCustomerId(null);
    setSelectedCustomerName("");
    setOrdersFilterMode("all");
    setCustomerMessage("");
    setOrderMessage("");
    setEmployeeMessage("");
    setCustomerSearch("");
    setEmployeeSearch("");
    setOrderSearch("");
    resetCustomerForm();
    resetOrderForm();
    resetEmployeeForm();
    setTimeEntries([]);
    setInvoices([]);
  };

  const handleCustomerChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setCustomerForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleQuoteChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setQuoteForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleOrderChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setOrderForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEmployeeChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEmployeeForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleSiteVisitChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setSiteVisitForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleRoomImagesSelected = (
    roomTempId: number,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    const selectedImages = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setRoomImages((prev) => ({
      ...prev,
      [roomTempId]: [...(prev[roomTempId] || []), ...selectedImages],
    }));
  };

  const addRoom = () => {
    setSiteVisitForm((prev) => ({
      ...prev,
      rooms: [
        ...prev.rooms,
        {
          temp_id: Date.now() + Math.floor(Math.random() * 1000),
          room_name: "",
          length_m: "",
          width_m: "",
          height_m: "",
          notes: "",
          paint_ceiling: true,
          manual_wall_area_sqm: "",
        },
      ],
    }));
  };

  const updateRoom = (
    tempId: number,
    field: keyof SiteVisitRoomForm,
    value: string | boolean
  ) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) =>
        room.temp_id === tempId ? { ...room, [field]: value } : room
      ),
    }));
  };

  const removeRoom = (tempId: number) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((room) => room.temp_id !== tempId),
      windows: prev.windows.filter((item) => item.room_temp_id !== tempId),
      doors: prev.doors.filter((item) => item.room_temp_id !== tempId),
      radiators: prev.radiators.filter((item) => item.room_temp_id !== tempId),
    }));
  };

  const addWindow = (roomTempId: number | null = null) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      windows: [
        ...prev.windows,
        {
          temp_id: Date.now() + Math.floor(Math.random() * 1000),
          room_temp_id: roomTempId ?? prev.rooms[0]?.temp_id ?? null,
          count_items: "1",
          width_m: "",
          height_m: "",
          notes: "",
        },
      ],
    }));
  };

  const updateWindow = (
    tempId: number,
    field: keyof SiteVisitWindowForm,
    value: string | number | null
  ) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      windows: prev.windows.map((item) =>
        item.temp_id === tempId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeWindow = (tempId: number) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      windows: prev.windows.filter((item) => item.temp_id !== tempId),
    }));
  };

  const addDoor = (roomTempId: number | null = null) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      doors: [
        ...prev.doors,
        {
          temp_id: Date.now() + Math.floor(Math.random() * 1000),
          room_temp_id: roomTempId ?? prev.rooms[0]?.temp_id ?? null,
          count_items: "1",
          width_m: "",
          height_m: "",
          frame_included: true,
          notes: "",
        },
      ],
    }));
  };

  const updateDoor = (
    tempId: number,
    field: keyof SiteVisitDoorForm,
    value: string | boolean | number | null
  ) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      doors: prev.doors.map((item) =>
        item.temp_id === tempId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeDoor = (tempId: number) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      doors: prev.doors.filter((item) => item.temp_id !== tempId),
    }));
  };

  const addRadiator = (roomTempId: number | null = null) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      radiators: [
        ...prev.radiators,
        {
          temp_id: Date.now() + Math.floor(Math.random() * 1000),
          room_temp_id: roomTempId ?? prev.rooms[0]?.temp_id ?? null,
          count_items: "1",
          width_m: "",
          height_m: "",
          radiator_type: "",
          notes: "",
        },
      ],
    }));
  };

  const updateRadiator = (
    tempId: number,
    field: keyof SiteVisitRadiatorForm,
    value: string | number | null
  ) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      radiators: prev.radiators.map((item) =>
        item.temp_id === tempId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeRadiator = (tempId: number) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      radiators: prev.radiators.filter((item) => item.temp_id !== tempId),
    }));
  };

  const addCustomService = () => {
    setSiteVisitForm((prev) => ({
      ...prev,
      custom_services: [
        ...prev.custom_services,
        {
          temp_id: Date.now() + Math.floor(Math.random() * 1000),
          title: "",
          description: "",
          hours: "",
        },
      ],
    }));
  };

  const updateCustomService = (
    tempId: number,
    field: keyof SiteVisitCustomServiceForm,
    value: string
  ) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      custom_services: prev.custom_services.map((item) =>
        item.temp_id === tempId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeCustomService = (tempId: number) => {
    setSiteVisitForm((prev) => ({
      ...prev,
      custom_services: prev.custom_services.filter((item) => item.temp_id !== tempId),
    }));
  };

  const loadSiteVisitsForCustomer = async (customerId: string) => {
    if (!customerId) {
      setAvailableSiteVisits([]);
      setSelectedSiteVisitId(null);
      return;
    }

    try {
      setLoadingSiteVisits(true);

      const { data, error } = await supabase
        .from("site_visits")
        .select("id, visit_number, title, visit_date, status, created_at")
        .eq("customer_id", Number(customerId))
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setAvailableSiteVisits(data || []);
      setSelectedSiteVisitId(null);
    } catch (error) {
      console.error("Fehler beim Laden der Besichtigungen:", error);
      setSiteVisitMessage("Besichtigungen konnten nicht geladen werden.");
    } finally {
      setLoadingSiteVisits(false);
    }
  };

  const loadSiteVisitForEditing = async (siteVisitId: number) => {
    if (!siteVisitId) return;

    setEditingSiteVisitId(siteVisitId);

    try {
      setLoadingSiteVisit(true);
      setSiteVisitMessage("");

      const { data: visit, error: visitError } = await supabase
        .from("site_visits")
        .select("*")
        .eq("id", siteVisitId)
        .single();

      if (visitError) throw visitError;

      const { data: rooms, error: roomsError } = await supabase
        .from("site_visit_rooms")
        .select("*")
        .eq("site_visit_id", siteVisitId);

      if (roomsError) throw roomsError;

      const { data: windows, error: windowsError } = await supabase
        .from("site_visit_windows")
        .select("*")
        .eq("site_visit_id", siteVisitId);

      if (windowsError) throw windowsError;

      const { data: doors, error: doorsError } = await supabase
        .from("site_visit_doors")
        .select("*")
        .eq("site_visit_id", siteVisitId);

      if (doorsError) throw doorsError;

      const { data: radiators, error: radiatorsError } = await supabase
        .from("site_visit_radiators")
        .select("*")
        .eq("site_visit_id", siteVisitId);

      if (radiatorsError) throw radiatorsError;

      const { data: services, error: servicesError } = await supabase
        .from("site_visit_custom_services")
        .select("*")
        .eq("site_visit_id", siteVisitId);

      if (servicesError) throw servicesError;

      const { data: images, error: imagesError } = await supabase
        .from("site_visit_images")
        .select("*")
        .eq("site_visit_id", siteVisitId);

      console.log("GELADENE RÄUME:", rooms);
      console.log("GELADENE BILDER:", images);

      if (imagesError) {
        throw imagesError;
      }

      const groupedSavedImages: Record<
        number,
        { file_path: string; file_name: string | null; signedUrl: string }[]
      > = {};

      for (const image of images || []) {
        const cleanFilePath = String(image.file_path || "").replace(
          /^site-visit-images\//,
          ""
        );

        const folderPath = cleanFilePath.split("/").slice(0, -1).join("/");

        const { data: signedData, error: signedError } = await supabase.storage
          .from("site-visit-images")
          .createSignedUrl(cleanFilePath, 60 * 60);

        if (signedError || !signedData?.signedUrl) {
          console.error("Fehler beim Erstellen der Bild-URL:", signedError);
          continue;
        }

        const roomTempId = Number(image.room_temp_id);

        if (!groupedSavedImages[roomTempId]) {
          groupedSavedImages[roomTempId] = [];
        }

        groupedSavedImages[roomTempId].push({
          file_path: image.file_path,
          file_name: image.file_name,
          signedUrl: signedData.signedUrl,
        });
      }

      setSavedRoomImages(groupedSavedImages);
      console.log("GRUPPIERTE BILDER:", groupedSavedImages);

      setSiteVisitForm((prev) => ({
        ...prev,
        customer_id: String(visit.customer_id),
        title: visit.title || "",
        visit_date: visit.visit_date || "",
        object_street: visit.object_street || "",
        object_zip: visit.object_zip || "",
        object_city: visit.object_city || "",
        notes: visit.notes || "",

        rooms:
          rooms?.map((r) => ({
            temp_id: r.id,
            room_name: r.room_name || "",
            paint_ceiling: r.paint_ceiling ?? true,
            length_m: r.length_m ?? "",
            width_m: r.width_m ?? "",
            height_m: r.height_m ?? "",
            manual_wall_area_sqm: r.manual_wall_area_sqm ?? "",
            notes: r.notes || "",
          })) || [],

        windows:
          windows?.map((w) => ({
            temp_id: w.id,
            room_temp_id: w.room_temp_id ?? w.room_id ?? null,
            count_items: String(w.count_items || 1),
            width_m: w.width_m ?? "",
            height_m: w.height_m ?? "",
            notes: w.notes || "",
          })) || [],

        doors: doors?.map((d) => ({
          temp_id: d.id,
          room_temp_id: d.room_temp_id ?? d.room_id,
          count_items: String(d.count_items || 1),
          width_m: d.width_m || "",
          height_m: d.height_m || "",
          frame_included: d.frame_included ?? false,
          notes: d.notes || "",
        })) || [],

        radiators:
          radiators?.map((r) => ({
            temp_id: r.id,
            room_temp_id: r.room_temp_id ?? r.room_id ?? null,
            count_items: String(r.count_items || 1),
            width_m: r.width_m ?? "",
            height_m: r.height_m ?? "",
            radiator_type: r.radiator_type || "",
            notes: r.notes || "",
          })) || [],

        custom_services: services?.map((s) => ({
          temp_id: s.id,
          title: s.title || "",
          description: s.description || "",
          hours: String(s.hours || ""),
          notes: s.notes || "",
        })) || [],
      }));

      setSiteVisitMessage("Besichtigung wurde geladen.");
    } catch (error) {
      console.error("Fehler beim Laden der Besichtigung:", error);
      setSiteVisitMessage("Besichtigung konnte nicht geladen werden.");
    } finally {
      setLoadingSiteVisit(false);
    }
  };

  const uploadRoomImages = async (
    siteVisitId: number,
    roomIdMap: Record<number, number>
  ) => {
    console.log("UPLOAD FUNKTION GESTARTET:", siteVisitId);
    console.log("ROOM IMAGES IN UPLOAD:", roomImages);
    if (!userProfile) return;

    const bucket = "site-visit-images";

    for (const [roomTempId, images] of Object.entries(roomImages)) {
      for (const image of images) {
        const file = image.file;

        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;

        const realRoomId = roomIdMap[Number(roomTempId)] ?? Number(roomTempId);

        const filePath = `${userProfile.tenant_id}/${siteVisitId}/${realRoomId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          console.error("Upload Fehler:", uploadError);
          alert("Upload Fehler: " + uploadError.message);
          continue;
        }

        const { error: imageInsertError } = await supabase.from("site_visit_images").insert({
          tenant_id: userProfile.tenant_id,
          site_visit_id: siteVisitId,
          room_temp_id: realRoomId,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          created_by: session?.user.id,
        });

        if (imageInsertError) {
          console.error("Bilddatenbank Fehler:", imageInsertError);
          alert("Bilddatenbank Fehler: " + imageInsertError.message);
        }
      }
    }
  };

  const handleDeleteSiteVisit = async () => {
    if (!editingSiteVisitId) return;

    const confirmDelete = window.confirm(
      "Möchten Sie diese Besichtigung wirklich löschen?"
    );

    if (!confirmDelete) return;

    try {
      setSavingSiteVisit(true);

      await supabase
        .from("site_visit_images")
        .delete()
        .eq("site_visit_id", editingSiteVisitId);

      await supabase
        .from("site_visit_windows")
        .delete()
        .eq("site_visit_id", editingSiteVisitId);

      await supabase
        .from("site_visit_doors")
        .delete()
        .eq("site_visit_id", editingSiteVisitId);

      await supabase
        .from("site_visit_radiators")
        .delete()
        .eq("site_visit_id", editingSiteVisitId);

      await supabase
        .from("site_visit_custom_services")
        .delete()
        .eq("site_visit_id", editingSiteVisitId);

      await supabase
        .from("site_visit_rooms")
        .delete()
        .eq("site_visit_id", editingSiteVisitId);

      await supabase
        .from("site_visits")
        .delete()
        .eq("id", editingSiteVisitId);

      setSavedRoomImages({});
      setRoomImages({});
      setEditingSiteVisitId(null);
      setSelectedSiteVisitId(null);
      setSiteVisitMessage("Besichtigung gelöscht");

      setSiteVisitForm((prev) => ({
        ...prev,
        customer_id: "",
        title: "",
        object_street: "",
        object_zip: "",
        object_city: "",
        visit_date: "",
        notes: "",
        rooms: [],
        windows: [],
        doors: [],
        radiators: [],
        custom_services: [],
      }));

      setAvailableSiteVisits([]);

      setOpenSections({
        general: false,
        rooms: false,
        windows: false,
        doors: false,
        radiators: false,
        custom: false,
      });

      if (siteVisitForm.customer_id) {
        loadSiteVisitsForCustomer(siteVisitForm.customer_id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSavingSiteVisit(false);
    }
  };

  const handleCreateSiteVisit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userProfile?.tenant_id) {
      setSiteVisitMessage("Tenant nicht gefunden.");
      return;
    }

    if (!siteVisitForm.customer_id) {
      setSiteVisitMessage("Bitte einen Kunden auswählen.");
      return;
    }

    if (!siteVisitForm.title.trim()) {
      setSiteVisitMessage("Bitte einen Titel eingeben.");
      return;
    }

    if (!siteVisitForm.rooms.length) {
      setSiteVisitMessage("Bitte mindestens einen Raum erfassen.");
      return;
    }

    try {
      setSavingSiteVisit(true);
      setSiteVisitMessage("");

      const siteVisitPayload = {
        tenant_id: userProfile.tenant_id,
        customer_id: Number(siteVisitForm.customer_id),
        title: siteVisitForm.title.trim(),
        object_street: siteVisitForm.object_street.trim() || null,
        object_zip: siteVisitForm.object_zip.trim() || null,
        object_city: siteVisitForm.object_city.trim() || null,
        visit_date: siteVisitForm.visit_date || null,
        notes: siteVisitForm.notes.trim() || null,
        measured_by: userProfile.id,
        assigned_project_manager_id: userProfile.role_id === 3 ? userProfile.id : null,
      };

      let siteVisitData;

      if (editingSiteVisitId) {
        const confirmUpdate = window.confirm(
          "Möchten Sie die bestehende Besichtigung wirklich überschreiben?"
        );

        if (!confirmUpdate) {
          setSavingSiteVisit(false);
          return;
        }

        const { data, error } = await supabase
          .from("site_visits")
          .update(siteVisitPayload)
          .eq("id", editingSiteVisitId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        siteVisitData = data;
      } else {
        const { data, error } = await supabase
          .from("site_visits")
          .insert(siteVisitPayload)
          .select()
          .single();

        if (error) {
          throw error;
        }

        siteVisitData = data;
      }

      if (editingSiteVisitId && siteVisitData?.id) {
        const existingSiteVisitId = siteVisitData.id;

        await supabase
          .from("site_visit_windows")
          .delete()
          .eq("site_visit_id", existingSiteVisitId);

        await supabase
          .from("site_visit_doors")
          .delete()
          .eq("site_visit_id", existingSiteVisitId);

        await supabase
          .from("site_visit_radiators")
          .delete()
          .eq("site_visit_id", existingSiteVisitId);

        await supabase
          .from("site_visit_custom_services")
          .delete()
          .eq("site_visit_id", existingSiteVisitId);

        await supabase
          .from("site_visit_rooms")
          .delete()
          .eq("site_visit_id", existingSiteVisitId);
      }

      const siteVisitId = siteVisitData.id;
      const roomIdMap: Record<number, number> = {};

      for (const room of siteVisitForm.rooms) {
        if (!room.room_name.trim()) continue;

        const roomPayload = {
          tenant_id: userProfile.tenant_id,
          site_visit_id: siteVisitId,
          room_name: room.room_name.trim(),
          length_m: room.length_m ? Number(room.length_m) : null,
          width_m: room.width_m ? Number(room.width_m) : null,
          height_m: room.height_m ? Number(room.height_m) : null,
          manual_wall_area_sqm: room.manual_wall_area_sqm
            ? Number(room.manual_wall_area_sqm)
            : null,
          notes: room.notes.trim() || null,
          paint_ceiling: room.paint_ceiling,
        };
        if (siteVisitData) {
          console.log("SITE VISIT ID:", siteVisitData.id);
          console.log("ROOM IMAGES VOR UPLOAD:", roomImages);

        }

        const { data: roomData, error: roomError } = await supabase
          .from("site_visit_rooms")
          .insert(roomPayload)
          .select()
          .single();

        if (roomError) {
          throw roomError;
        }

        roomIdMap[Number(room.temp_id)] = roomData.id;
      }

      if (editingSiteVisitId) {
        for (const [oldRoomId, newRoomId] of Object.entries(roomIdMap)) {
          await supabase
            .from("site_visit_images")
            .update({
              room_temp_id: newRoomId,
            })
            .eq("site_visit_id", siteVisitId)
            .eq("room_temp_id", Number(oldRoomId));
        }
      }

      await uploadRoomImages(siteVisitData.id, roomIdMap);

      for (const item of siteVisitForm.windows) {
        if (!item.room_temp_id || !roomIdMap[item.room_temp_id]) continue;

        const payload = {
          tenant_id: userProfile.tenant_id,
          site_visit_id: siteVisitId,
          room_id: roomIdMap[item.room_temp_id],
          count_items: item.count_items ? Number(item.count_items) : 1,
          width_m: item.width_m ? Number(item.width_m) : null,
          height_m: item.height_m ? Number(item.height_m) : null,
          notes: item.notes.trim() || null,
        };

        const { error } = await supabase.from("site_visit_windows").insert(payload);
        if (error) throw error;
      }

      for (const item of siteVisitForm.doors) {
        if (!item.room_temp_id || !roomIdMap[item.room_temp_id]) continue;

        const payload = {
          tenant_id: userProfile.tenant_id,
          site_visit_id: siteVisitId,
          room_id: roomIdMap[item.room_temp_id],
          count_items: item.count_items ? Number(item.count_items) : 1,
          width_m: item.width_m ? Number(item.width_m) : null,
          height_m: item.height_m ? Number(item.height_m) : null,
          frame_included: !!item.frame_included,
          notes: item.notes.trim() || null,
        };

        const { error } = await supabase.from("site_visit_doors").insert(payload);
        if (error) throw error;
      }

      for (const item of siteVisitForm.radiators) {
        if (!item.room_temp_id || !roomIdMap[item.room_temp_id]) continue;

        const payload = {
          tenant_id: userProfile.tenant_id,
          site_visit_id: siteVisitId,
          room_id: roomIdMap[item.room_temp_id],
          count_items: item.count_items ? Number(item.count_items) : 1,
          width_m: item.width_m ? Number(item.width_m) : null,
          height_m: item.height_m ? Number(item.height_m) : null,
          radiator_type: item.radiator_type.trim() || null,
          notes: item.notes.trim() || null,
        };

        const { error } = await supabase.from("site_visit_radiators").insert(payload);
        if (error) throw error;
      }

      // 🔥 NEU: Sonderleistungen speichern
      for (const item of siteVisitForm.custom_services) {
        if (!item.title.trim()) continue;

        const payload = {
          tenant_id: userProfile.tenant_id,
          site_visit_id: siteVisitId,
          title: item.title.trim(),
          description: item.description.trim() || null,
          hours: item.hours ? Number(item.hours) : 0,
        };

        const { error } = await supabase
          .from("site_visit_custom_services")
          .insert(payload);

        if (error) throw error;
      }

      if (createQuoteAfterSave) {
        const { data: quoteId, error: quoteError } = await supabase.rpc(
          "generate_quote_from_site_visit",
          {
            p_site_visit_id: siteVisitId,
          }
        );

        if (quoteError) {
          throw quoteError;
        }

        await loadQuotes(userProfile.tenant_id);

        setSiteVisitMessage(
          `Aufmaß gespeichert und Angebot erfolgreich erzeugt. Angebots-ID: ${quoteId}`
        );
      } else {
        setSiteVisitMessage("Aufmaß erfolgreich gespeichert.");
      }
      setSelectedSiteVisitId(null);
      setEditingSiteVisitId(null);

      setOpenSections({
        general: false,
        rooms: false,
        windows: false,
        doors: false,
        radiators: false,
        custom: false,
      });

      setSiteVisitForm({
        customer_id: "",
        title: "",
        object_street: "",
        object_zip: "",
        object_city: "",
        visit_date: new Date().toISOString().slice(0, 10),
        notes: "",
        rooms: [
          {
            temp_id: Date.now(),
            room_name: "",
            length_m: "",
            width_m: "",
            height_m: "",
            notes: "",
            paint_ceiling: true,
            manual_wall_area_sqm: "",
          },
        ],
        windows: [],
        doors: [],
        radiators: [],
        custom_services: [],
      });
    } catch (error: any) {
      console.error("Fehler beim Speichern des Aufmaßes:", error);
      setSiteVisitMessage(error?.message || "Aufmaß konnte nicht gespeichert werden.");
    } finally {
      setSavingSiteVisit(false);
      setCreateQuoteAfterSave(false);
    }
  };

  const openDashboard = () => {
    if (isEmployee) {
      setCurrentPage("employee-dashboard");
      return;
    }

    setCurrentPage("dashboard");
  };

  const openCustomersListPage = () => {
    setCurrentPage("customers-list");
  };

  const openOrdersListPage = (mode: OrdersFilterMode = "all") => {
    setOrdersFilterMode(mode);
    setCurrentPage("orders-list");
  };

  const openMessagesPage = async () => {
  if (!userProfile) {
    setCurrentPage("messages");
    return;
  }

  setCurrentPage("messages");

  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("tenant_id", userProfile.tenant_id)
    .is("read_at", null)
    .neq("sender_id", userProfile.id)
    .or(`recipient_id.is.null,recipient_id.eq.${userProfile.id}`);

  if (error) {
    console.error("Fehler beim Markieren als gelesen:", error);
    return;
  }

  await loadMessages(userProfile.tenant_id);
};

  const openEmployeesListPage = () => {
    setCurrentPage("employees-list");
  };

  const openCreateCustomerPage = () => {
    setCustomerMessage("");
    setEditingCustomerId(null);
    resetCustomerForm();
    setCurrentPage("create-customer");
  };

    const openEditCustomerPage = (customer: Customer) => {
      setCustomerMessage("");
      setEditingCustomerId(customer.id);
      setCustomerForm({
        first_name: customer.first_name || "",
        last_name: customer.last_name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        street: customer.street || "",
        zip: customer.zip || "",
        city: customer.city || "",
        notes: customer.notes || "",
        company_name: customer.company_name || "",

        discount_type: customer.discount_type || "percent",
        discount_value: customer.discount_value ? String(customer.discount_value) : "",
        discount_note: customer.discount_note || "",
      });

      setCurrentPage("edit-customer");
    };

    const openCreateOrderPage = () => {
      if (!canCreateOrders) return;

      setOrderMessage("");
      setEditingOrderId(null);
      resetOrderForm();
      setCurrentPage("create-order");
    };

    const openEditOrderPage = (order: Order) => {
  if (!canEditOrders) return;

  setOrderMessage("");
  setEditingOrderId(order.id);

  setOrderForm({
    customer_id: order.customer_id || "",
    title: order.title || "",
    description: order.description || "",
    status: order.status || "neu",
    address_street: order.address_street || "",
    address_zip: order.address_zip || "",
    address_city: order.address_city || "",
    start_date: order.start_date || "",
    end_date: order.end_date || "",
    assigned_to: "",
  });

  setSelectedProjectManagerId(
    order.assigned_project_manager_id
      ? String(order.assigned_project_manager_id)
      : ""
  );

  setSelectedEmployeeIds([]);

  loadOrderProgress(order.id, order.tenant_id);
  setCurrentPage("edit-order");
};

    const openCreateEmployeePage = () => {
      setEmployeeMessage("");
      setEditingEmployeeId(null);
      resetEmployeeForm();
      setCurrentPage("create-employee");
    };

    const openEditEmployeePage = (employee: AppUser) => {
      setEmployeeMessage("");
      setEditingEmployeeId(employee.id);
      setEmployeeForm({
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        email: employee.email || "",
        phone: employee.phone || "",
        password: "",
        role_id: String(employee.role_id),
        hourly_rate: employee.hourly_rate != null ? String(employee.hourly_rate) : "",
      });
      setCurrentPage("edit-employee");
    };

    const handleSelectCustomer = (customer: Customer) => {
      setSelectedCustomerId(customer.id);
      setSelectedCustomerName(`${customer.first_name} ${customer.last_name}`);
      setOrdersFilterMode("customer");
      setCurrentPage("orders-list");
    };

    const clearCustomerFilter = () => {
      setSelectedCustomerId(null);
      setSelectedCustomerName("");
      setOrdersFilterMode("all");
    };

    const handleCreateCustomer = async (e: React.FormEvent) => {
      e.preventDefault();
      setCustomerMessage("");

      if (!userProfile) {
        setCustomerMessage("Benutzerprofil nicht geladen.");
        return;
      }

      if (!customerForm.first_name.trim() || !customerForm.last_name.trim()) {
        setCustomerMessage("Bitte Vorname und Nachname ausfüllen.");
        return;
      }

      setSavingCustomer(true);

      const newCustomer = {
        tenant_id: userProfile.tenant_id,
        first_name: customerForm.first_name.trim(),
        last_name: customerForm.last_name.trim(),
        email: customerForm.email.trim() || null,
        phone: customerForm.phone.trim() || null,
        street: customerForm.street.trim() || null,
        zip: customerForm.zip.trim() || null,
        city: customerForm.city.trim() || null,
        notes: customerForm.notes.trim() || null,
        company_name: customerForm.company_name.trim() || null,

        discount_type: customerForm.discount_type,
        discount_value: customerForm.discount_value
          ? Number(customerForm.discount_value)
          : 0,
        discount_note: customerForm.discount_note.trim() || null,
      };

      const { error } = await supabase.from("customers").insert([newCustomer]);
        console.log("Read update error:", error);
      if (error) {
        console.error("Fehler beim Speichern des Kunden:", error);
        setCustomerMessage(`Kunde konnte nicht gespeichert werden: ${error.message}`);
        setSavingCustomer(false);
        return;
      }

      setCustomerMessage("Kunde erfolgreich gespeichert.");
      resetCustomerForm();
      await loadCustomers(userProfile.tenant_id);
      setCurrentPage("customers-list");
      setSavingCustomer(false);
    };

    const handleUpdateCustomer = async (e: React.FormEvent) => {
      e.preventDefault();
      setCustomerMessage("");

      if (!userProfile || !editingCustomerId) {
        setCustomerMessage("Kein Kunde zum Bearbeiten ausgewählt.");
        return;
      }

      if (!customerForm.first_name.trim() || !customerForm.last_name.trim()) {
        setCustomerMessage("Bitte Vorname und Nachname ausfüllen.");
        return;
      }

      setSavingCustomer(true);

      const updatedCustomer = {
        first_name: customerForm.first_name.trim(),
        last_name: customerForm.last_name.trim(),
        email: customerForm.email.trim() || null,
        phone: customerForm.phone.trim() || null,
        street: customerForm.street.trim() || null,
        zip: customerForm.zip.trim() || null,
        city: customerForm.city.trim() || null,
        notes: customerForm.notes.trim() || null,
        company_name: customerForm.company_name.trim() || null,

        discount_type: customerForm.discount_type,
        discount_value: customerForm.discount_value
          ? Number(customerForm.discount_value)
          : 0,
        discount_note: customerForm.discount_note.trim() || null,
      };

      const { error } = await supabase
        .from("customers")
        .update(updatedCustomer)
        .eq("id", editingCustomerId)
        .eq("tenant_id", userProfile.tenant_id);

      if (error) {
        console.error("Fehler beim Aktualisieren des Kunden:", error);
        setCustomerMessage(`Kunde konnte nicht aktualisiert werden: ${error.message}`);
        setSavingCustomer(false);
        return;
      }

      setCustomerMessage("Kunde erfolgreich aktualisiert.");
      await loadCustomers(userProfile.tenant_id);
      setEditingCustomerId(null);
      resetCustomerForm();
      setCurrentPage("customers-list");
      setSavingCustomer(false);
    };

    const handleCreateOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      setOrderMessage("");

      if (!userProfile) {
        setOrderMessage("Benutzerprofil nicht geladen.");
        return;
      }

      if (!orderForm.customer_id || !orderForm.title.trim()) {
        setOrderMessage("Bitte Kunde und Auftragstitel ausfüllen.");
        return;
      }

      setSavingOrder(true);

      const newOrder = {
        tenant_id: userProfile.tenant_id,
        customer_id: orderForm.customer_id,
        title: orderForm.title.trim(),
        description: orderForm.description.trim() || null,
        status: orderForm.status || "neu",
        address_street: orderForm.address_street.trim() || null,
        address_zip: orderForm.address_zip.trim() || null,
        address_city: orderForm.address_city.trim() || null,
        start_date: orderForm.start_date || null,
        end_date: orderForm.end_date || null,
        assigned_to: null,
assigned_project_manager_id: selectedProjectManagerId
  ? Number(selectedProjectManagerId)
  : null,
        created_by: userProfile.id,
      };

      const { error } = await supabase.from("orders").insert([newOrder]);

      if (error) {
        console.error("Fehler beim Speichern des Auftrags:", error);
        setOrderMessage(`Auftrag konnte nicht gespeichert werden: ${error.message}`);
        setSavingOrder(false);
        return;
      }

      setOrderMessage("Auftrag erfolgreich gespeichert.");
      resetOrderForm();
      await loadOrders(userProfile.tenant_id);
      setCurrentPage("orders-list");
      setOrdersFilterMode("all");
      setSavingOrder(false);
    };

    const handleUpdateOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      setOrderMessage("");

      if (!userProfile || !editingOrderId) {
        setOrderMessage("Kein Auftrag zum Bearbeiten ausgewählt.");
        return;
      }

      if (!orderForm.customer_id || !orderForm.title.trim()) {
        setOrderMessage("Bitte Kunde und Auftragstitel ausfüllen.");
        return;
      }

      setSavingOrder(true);

      const updatedOrder = {
        customer_id: orderForm.customer_id,
        title: orderForm.title.trim(),
        description: orderForm.description.trim() || null,
        status: orderForm.status || "neu",
        address_street: orderForm.address_street.trim() || null,
        address_zip: orderForm.address_zip.trim() || null,
        address_city: orderForm.address_city.trim() || null,
        start_date: orderForm.start_date || null,
        end_date: orderForm.end_date || null,
        assigned_to: orderForm.assigned_to ? Number(orderForm.assigned_to) : null,
      };

      const { error } = await supabase
        .from("orders")
        .update(updatedOrder)
        .eq("id", editingOrderId)
        .eq("tenant_id", userProfile.tenant_id);

      if (error) {
        console.error("Fehler beim Aktualisieren des Auftrags:", error);
        setOrderMessage(`Auftrag konnte nicht aktualisiert werden: ${error.message}`);
        setSavingOrder(false);
        return;
      }

      const { error: deleteAssignmentsError } = await supabase
  .from("order_assignments")
  .delete()
  .eq("order_id", editingOrderId)
  .eq("tenant_id", userProfile.tenant_id);

if (deleteAssignmentsError) {
  console.error("Fehler beim Löschen alter Zuweisungen:", deleteAssignmentsError);
  setOrderMessage(
    `Alte Zuweisungen konnten nicht gelöscht werden: ${deleteAssignmentsError.message}`
  );
  setSavingOrder(false);
  return;
}

const assignments = [
  ...(selectedProjectManagerId
    ? [
        {
          tenant_id: userProfile.tenant_id,
          order_id: editingOrderId,
          user_id: Number(selectedProjectManagerId),
          assignment_role: "project_manager",
        },
      ]
    : []),

  ...selectedEmployeeIds.map((id) => ({
    tenant_id: userProfile.tenant_id,
    order_id: editingOrderId,
    user_id: Number(id),
    assignment_role: "employee",
  })),
];

if (assignments.length > 0) {
  const { error: assignmentsError } = await supabase
    .from("order_assignments")
    .insert(assignments);

  if (assignmentsError) {
    console.error("Fehler beim Speichern der Zuweisungen:", assignmentsError);
    setOrderMessage(
      `Zuweisungen konnten nicht gespeichert werden: ${assignmentsError.message}`
    );
    setSavingOrder(false);
    return;
  }
}

      setOrderMessage("Auftrag erfolgreich aktualisiert.");
      await loadOrders(userProfile.tenant_id);
      setEditingOrderId(null);
      resetOrderForm();
      setCurrentPage("orders-list");
      setSavingOrder(false);
    };

    const handleCreateQuote = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!userProfile?.tenant_id) {
        setQuoteMessage("Tenant nicht gefunden.");
        return;
      }

      if (!quoteForm.customer_id) {
        setQuoteMessage("Bitte einen Kunden auswählen.");
        return;
      }

      if (!quoteForm.title.trim()) {
        setQuoteMessage("Bitte einen Titel für das Angebot eingeben.");
        return;
      }

      try {
        setSavingQuote(true);
        setQuoteMessage("");

        const payload = {
          tenant_id: userProfile.tenant_id,
          customer_id: Number(quoteForm.customer_id),
          title: quoteForm.title.trim(),
          description: quoteForm.description.trim() || null,
          address_street: quoteForm.address_street.trim() || null,
          address_zip: quoteForm.address_zip.trim() || null,
          address_city: quoteForm.address_city.trim() || null,
          quote_date: quoteForm.quote_date || null,
          valid_until: quoteForm.valid_until || null,
          notes: quoteForm.notes.trim() || null,
          tax_rate: companySettings?.tax_rate_default ?? 19,
          created_by: userProfile.id,
        };

        const { error } = await supabase.from("quotes").insert(payload);

        if (error) {
          throw error;
        }

        setQuoteMessage("Angebot erfolgreich erstellt.");

        setQuoteForm({
          customer_id: "",
          title: "",
          description: "",
          address_street: "",
          address_zip: "",
          address_city: "",
          quote_date: new Date().toISOString().slice(0, 10),
          valid_until: "",
          notes: "",
        });
      } catch (error: any) {
        console.error("Fehler beim Erstellen des Angebots:", error);
        setQuoteMessage(error?.message || "Angebot konnte nicht erstellt werden.");
      } finally {
        setSavingQuote(false);
      }
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
      e.preventDefault();
      setEmployeeMessage("");

      if (!employeeForm.first_name.trim() || !employeeForm.last_name.trim() || !employeeForm.email.trim()) {
        setEmployeeMessage("Bitte Vorname, Nachname und E-Mail ausfüllen.");
        return;
      }

      if (!employeeForm.password || employeeForm.password.length < 8) {
        setEmployeeMessage("Das Passwort muss mindestens 8 Zeichen lang sein.");
        return;
      }

      if (!userProfile) {
        setEmployeeMessage("Benutzerprofil nicht geladen.");
        return;
      }

      if (!session?.access_token) {
        setEmployeeMessage("Deine Sitzung ist nicht mehr gültig. Bitte neu einloggen.");
        return;
      }

      setSavingEmployee(true);

      try {
        console.log("session access token vorhanden:", !!session?.access_token);
        console.log("token prefix:", session?.access_token?.slice(0, 20));
        console.log("function url:", `${supabaseUrl}/functions/v1/create-employee-auth`);
        console.log("anon key prefix:", supabaseAnonKey?.slice(0, 20));
        console.log("Create employee - session vorhanden:", !!session);
        console.log("Create employee - access token vorhanden:", !!session?.access_token);
        console.log("Create employee - access token prefix:", session?.access_token?.slice(0, 20));

        const response = await fetch(
          `${supabaseUrl}/functions/v1/create-employee-auth`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseAnonKey,
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              first_name: employeeForm.first_name.trim(),
              last_name: employeeForm.last_name.trim(),
              email: employeeForm.email.trim().toLowerCase(),
              phone: employeeForm.phone.trim(),
              password: employeeForm.password,
              role_id: Number(employeeForm.role_id),
              hourly_rate: employeeForm.hourly_rate ? Number(employeeForm.hourly_rate) : null,
            }),
          }
        );

        const result = await response.json().catch(() => ({}));

        console.log("create-employee-auth status:", response.status);
        console.log("create-employee-auth response:", result);

        if (!response.ok) {
          const message = result?.error || result?.message || `HTTP-Fehler ${response.status}`;
          setEmployeeMessage(`Mitarbeiter konnte nicht gespeichert werden: ${message}`);
          setSavingEmployee(false);
          return;
        }

        setEmployeeMessage("Mitarbeiter mit Login erfolgreich angelegt.");
        resetEmployeeForm();
        await loadEmployees(userProfile.tenant_id);
        setCurrentPage("employees-list");
      } catch (error) {
        console.error("Fehler beim Anlegen des Mitarbeiters:", error);
        setEmployeeMessage(
          `Mitarbeiter konnte nicht gespeichert werden: ${error instanceof Error ? error.message : "Unbekannter Fehler"
          }`
        );
      } finally {
        setSavingEmployee(false);
      }
    };

    const handleUpdateEmployee = async (e: React.FormEvent) => {
      e.preventDefault();
      setEmployeeMessage("");

      if (!userProfile || !editingEmployeeId) {
        setEmployeeMessage("Kein Mitarbeiter zum Bearbeiten ausgewählt.");
        return;
      }

      if (
        !employeeForm.first_name.trim() ||
        !employeeForm.last_name.trim() ||
        !employeeForm.email.trim()
      ) {
        setEmployeeMessage("Bitte Vorname, Nachname und E-Mail ausfüllen.");
        return;
      }

      setSavingEmployee(true);

      const updatedEmployee = {
        first_name: employeeForm.first_name.trim(),
        last_name: employeeForm.last_name.trim(),
        email: employeeForm.email.trim(),
        phone: employeeForm.phone.trim() || null,
        role_id: Number(employeeForm.role_id),
        hourly_rate: employeeForm.hourly_rate ? Number(employeeForm.hourly_rate) : null,
      };

      const { error } = await supabase
        .from("app_users")
        .update(updatedEmployee)
        .eq("id", editingEmployeeId)
        .eq("tenant_id", userProfile.tenant_id);

      if (error) {
        console.error("Fehler beim Aktualisieren des Mitarbeiters:", error);
        setEmployeeMessage(`Mitarbeiter konnte nicht aktualisiert werden: ${error.message}`);
        setSavingEmployee(false);
        return;
      }

      setEmployeeMessage("Mitarbeiter erfolgreich aktualisiert.");
      await loadEmployees(userProfile.tenant_id);
      setEditingEmployeeId(null);
      resetEmployeeForm();
      setCurrentPage("employees-list");
      setSavingEmployee(false);
    };

    const handleDeleteCustomer = async (customerId: string) => {
      if (!userProfile) return;

      const confirmed = window.confirm(
        "Soll dieser Kunde wirklich gelöscht werden?"
      );

      if (!confirmed) return;

      setCustomerMessage("");
      setDeletingCustomerId(customerId);

      const { count, error: countError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", userProfile.tenant_id)
        .eq("customer_id", customerId);

      if (countError) {
        console.error("Fehler beim Prüfen der Aufträge:", countError);
        setCustomerMessage("Kunde konnte nicht geprüft werden.");
        setDeletingCustomerId(null);
        return;
      }

      if ((count || 0) > 0) {
        setCustomerMessage(
          "Dieser Kunde kann nicht gelöscht werden, da noch Aufträge mit ihm verknüpft sind."
        );
        setDeletingCustomerId(null);
        return;
      }

      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId)
        .eq("tenant_id", userProfile.tenant_id);

      if (error) {
        console.error("Fehler beim Löschen des Kunden:", error);
        setCustomerMessage(`Kunde konnte nicht gelöscht werden: ${error.message}`);
        setDeletingCustomerId(null);
        return;
      }

      if (selectedCustomerId === customerId) {
        clearCustomerFilter();
      }

      setCustomerMessage("Kunde erfolgreich gelöscht.");
      await loadCustomers(userProfile.tenant_id);
      setDeletingCustomerId(null);
    };

    const handleDeleteEmployee = async (employeeId: number) => {
      if (!userProfile) return;

      const confirmed = window.confirm(
        "Soll dieser Mitarbeiter wirklich gelöscht werden?"
      );

      if (!confirmed) return;

      setEmployeeMessage("");
      setDeletingEmployeeId(employeeId);

      const { error } = await supabase
        .from("app_users")
        .delete()
        .eq("id", employeeId)
        .eq("tenant_id", userProfile.tenant_id)
        .eq("role_id", EMPLOYEE_ROLE_ID);

      if (error) {
        console.error("Fehler beim Löschen des Mitarbeiters:", error);
        setEmployeeMessage(`Mitarbeiter konnte nicht gelöscht werden: ${error.message}`);
        setDeletingEmployeeId(null);
        return;
      }

      setEmployeeMessage("Mitarbeiter erfolgreich gelöscht.");
      await loadEmployees(userProfile.tenant_id);
      setDeletingEmployeeId(null);
    };

    const customerNameMap = useMemo(() => {
      const map = new Map<string, string>();
      customers.forEach((customer) => {
        map.set(customer.id, `${customer.first_name} ${customer.last_name}`);
      });
      return map;
    }, [customers]);

    const employeeNameMap = useMemo(() => {
      const map = new Map<number, string>();
      employees.forEach((employee) => {
        map.set(
          employee.id,
          `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || `Mitarbeiter #${employee.id}`
        );
      });
      return map;
    }, [employees]);

    const userNameMap = useMemo(() => {
  const map = new Map<number, string>();

  [...employees, ...messageRecipients].forEach((user) => {
    if (!map.has(Number(user.id))) {
      map.set(
        Number(user.id),
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email ||
          `Benutzer #${user.id}`
      );
    }
  });

  if (userProfile) {
    map.set(
      Number(userProfile.id),
      `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() ||
        userProfile.email ||
        "Ich"
    );
  }

  return map;
}, [employees, messageRecipients, userProfile]);

    const orderEmployeeNamesMap = useMemo(() => {
  const map = new Map<string, string>();

  orderAssignments.forEach((assignment) => {
    const orderId = String(assignment.order_id);

    const personName =
      employeeNameMap.get(Number(assignment.user_id)) ||
      `Mitarbeiter #${assignment.user_id}`;

    let label = personName;

    if (assignment.assignment_role === "project_manager") {
      label = `🟦 Projektleiter: ${personName}`;
    }

    if (assignment.assignment_role === "employee") {
      label = `🟩 ${personName}`;
    }

    const currentNames = map.get(orderId);

    map.set(
      orderId,
      currentNames ? `${currentNames}<br>${label}` : label
    );
  });

  return map;
}, [orderAssignments, employeeNameMap]);

    const stats = useMemo(() => {
      const totalCustomers = customers.length;
      const totalOrders = orders.length;
const totalInvoices = invoices.length;
const totalEmployees = employees.length;

      const openOrders = orders.filter(
        (order) => order.status !== "fertig" && order.status !== "abgerechnet"
      ).length;

      const completedOrders = orders.filter(
        (order) => order.status === "fertig" || order.status === "abgerechnet"
      ).length;

      return {
        totalCustomers,
        totalOrders,
        totalInvoices,
        totalEmployees,
        openOrders,
        completedOrders,
      };
    }, [customers, orders, invoices, employees]);

    const filteredCustomers = useMemo(() => {
      const term = customerSearch.trim().toLowerCase();

      if (!term) return customers;

      return customers.filter((customer) => {
        const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();

        return (
          fullName.includes(term) ||
          (customer.company_name || "").toLowerCase().includes(term) || // 👈 NEU
          (customer.email || "").toLowerCase().includes(term) ||
          (customer.phone || "").toLowerCase().includes(term) ||
          (customer.street || "").toLowerCase().includes(term) ||
          (customer.zip || "").toLowerCase().includes(term) ||
          (customer.city || "").toLowerCase().includes(term)
        );
      });
    }, [customers, customerSearch]);

    const filteredEmployees = useMemo(() => {
      const term = employeeSearch.trim().toLowerCase();

      if (!term) return employees;

      return employees.filter((employee) => {
        const fullName = `${employee.first_name || ""} ${employee.last_name || ""}`.toLowerCase();

        return (
          fullName.includes(term) ||
          (employee.email || "").toLowerCase().includes(term) ||
          (employee.phone || "").toLowerCase().includes(term)
        );
      });
    }, [employees, employeeSearch]);

    const ordersByMode = useMemo(() => {
  switch (ordersFilterMode) {
    case "open":
      return orders.filter(
        (order) =>
          order.status !== "fertig" &&
          order.status !== "abgerechnet"
      );

    case "finished":
      return orders.filter(
        (order) => order.status === "fertig"
      );

    case "billed":
      return orders.filter(
        (order) => order.status === "abgerechnet"
      );

    case "completed":
      return orders.filter(
        (order) =>
          order.status === "fertig" ||
          order.status === "abgerechnet"
      );

    case "customer":
      return selectedCustomerId
        ? orders.filter(
            (order) => order.customer_id === selectedCustomerId
          )
        : orders;

    default:
      return orders;
  }
}, [orders, ordersFilterMode, selectedCustomerId]);

    const filteredOrders = useMemo(() => {
      let result = ordersByMode;

      if (selectedEmployeeFilterId === "unassigned") {
        result = result.filter((order) => !order.assigned_to);
      } else if (selectedEmployeeFilterId) {
        result = result.filter(
          (order) => String(order.assigned_to || "") === selectedEmployeeFilterId
        );
      }

      const term = orderSearch.trim().toLowerCase();

      if (!term) return result;

      return result.filter((order) => {
        const customerName = customerNameMap.get(order.customer_id)?.toLowerCase() || "";
        const employeeName = order.assigned_to
          ? employeeNameMap.get(order.assigned_to)?.toLowerCase() || ""
          : "";
        const address = [
          order.address_street || "",
          order.address_zip || "",
          order.address_city || "",
        ]
          .join(" ")
          .toLowerCase();

        return (
          (order.title || "").toLowerCase().includes(term) ||
          (order.description || "").toLowerCase().includes(term) ||
          (order.status || "").toLowerCase().includes(term) ||
          customerName.includes(term) ||
          employeeName.includes(term) ||
          address.includes(term)
        );
      });
    }, [ordersByMode, selectedEmployeeFilterId, orderSearch, customerNameMap, employeeNameMap]);

    const formatDateTime = (value: string) => {
      const hasTimezone = /[zZ]|[+\-]\d{2}:\d{2}$/.test(value);
      const normalizedValue = hasTimezone ? value : `${value}Z`;

      return new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Madrid",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(normalizedValue));
    };

    const getOrdersListTitle = () => {
      switch (ordersFilterMode) {
        case "open":
          return "Offene Aufträge";
        case "completed":
          return "Fertige / Abgerechnete Aufträge";
        case "customer":
          return selectedCustomerName
            ? `Aufträge von ${selectedCustomerName}`
            : "Auftragsliste";
        default:
          return "Auftragsliste";
      }
    };
    const handleAssignOrder = async (
  orderId: string,
  projectManagerId: number,
  employeeIds: number[]
) => {
  if (!userProfile || !canAssignOrders) return;

  // 1) Auftrag aktualisieren
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      assigned_project_manager_id: projectManagerId,
      assigned_to: employeeIds.length > 0 ? employeeIds[0] : null, // Übergang
    })
    .eq("id", orderId)
    .eq("tenant_id", userProfile.tenant_id);

  if (orderError) {
    console.error("Fehler beim Aktualisieren des Auftrags:", orderError);
    throw orderError;
  }

  // 2) Alte Zuordnungen löschen
  const { error: deleteError } = await supabase
    .from("order_assignments")
    .delete()
    .eq("tenant_id", userProfile.tenant_id)
    .eq("order_id", orderId);

  if (deleteError) {
    console.error("Fehler beim Löschen alter Zuordnungen:", deleteError);
    throw deleteError;
  }

  // 3) Projektleiter + Mitarbeiter neu speichern
  const assignments = [
    {
      tenant_id: userProfile.tenant_id,
      order_id: orderId,
      user_id: projectManagerId,
      assignment_role: "project_manager",
    },
    ...employeeIds.map((id) => ({
      tenant_id: userProfile.tenant_id,
      order_id: orderId,
      user_id: id,
      assignment_role: "employee",
    })),
  ];

  const { error: insertError } = await supabase
    .from("order_assignments")
    .insert(assignments);

  if (insertError) {
    console.error("Fehler beim Speichern der Zuordnungen:", insertError);
    throw insertError;
  }

  await Promise.all([
    loadOrders(userProfile.tenant_id),
    loadEmployees(userProfile.tenant_id),
    loadProgressEntries(userProfile.tenant_id),
  ]);
};
    const getProgressEntriesForOrder = (orderId: string) => {
      return progressEntries.filter((entry) => entry.order_id === orderId);
    };

    const getOrdersListDescription = () => {
      switch (ordersFilterMode) {
        case "open":
          return "Alle offenen und aktiven Aufträge.";
        case "completed":
          return "Alle fertigen oder abgerechneten Aufträge.";
        case "customer":
          return selectedCustomerName
            ? "Es werden nur die Aufträge des ausgewählten Kunden angezeigt."
            : "Alle Aufträge.";
        default:
          return "Alle Aufträge mit Status und Kundenzuordnung.";
      }
    };

    const getStatusClass = (status: string) => {
      switch (status) {
        case "neu":
          return "status-badge status-neu";
        case "geplant":
          return "status-badge status-geplant";
        case "in_arbeit":
          return "status-badge status-inbearbeitung";
        case "pausiert":
          return "status-badge status-pausiert";
         case "zur_pruefung":
          return "status-badge status-zur-pruefung"; 
        case "fertig":
          return "status-badge status-fertig";
        case "abgerechnet":
          return "status-badge status-abgerechnet";
        default:
          return "status-badge";
      }
    };

    if (loadingApp) {
      return (
        <div className="app-shell">
          <div className="loading-box">
            <h1>Maler SaaS Plattform</h1>
            <p>Lade Anwendung...</p>
          </div>
        </div>
      );
    }

if (showCompanyRegister) {
  return (
    <CompanyRegisterPage
      onBackToLogin={() => setShowCompanyRegister(false)}
    />
  );
}

if (
  showCompanyOnboarding &&
  userProfile?.tenant_id &&
  userProfile?.role_id === 2
) {
  return (
    <CompanyOnboardingPage
      tenantId={Number(userProfile.tenant_id)}
      onCompleted={() => {
        setShowCompanyOnboarding(false);
        loadCompanySettings(Number(userProfile.tenant_id));
      }}
    />
  );
}

    if (!session) {
      return (
        <div className="login-page">
          <div className="login-card">
            <div className="login-header">
              <h1>Maler SaaS Plattform</h1>
              <p>Bitte einloggen, um das Dashboard zu öffnen.</p>
            </div>

            <form onSubmit={handleLogin} className="form-stack">
              <div className="form-group">
                <label>E-Mail</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Passwort</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Einloggen
              </button>
              <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: 12 }}
              onClick={() => setShowCompanyRegister(true)}
              >
              Neue Firma registrieren
            </button>
            </form>

            {loginMessage && <p className="info-text">{loginMessage}</p>}
          </div>
        </div>
      );
    }

    if (!loadingData && userProfile && isEmployee && currentPage === "employee-dashboard") {
      const fullName =
        `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() ||
        session.user.email ||
        "Mitarbeiter";

      return (
        <EmployeeDashboard
          userName={fullName}
          userEmail={session.user.email || ""}
          onLogout={handleLogout}
          onOpenMessages={openMessagesPage}
          unreadMessages={unreadMessages}

          orders={orders}
          progressEntries={progressEntries}
          timeEntries={timeEntries}
          progressImages={progressImages}
          onUpdateOrderStatus={handleEmployeeUpdateOrderStatus}
          onCreateProgress={handleCreateProgress}
          onReloadProgress={async () => {
          if (userProfile) {
          await loadEmployeeProgressEntries(userProfile.tenant_id, userProfile.id);
  }
}}
onReloadOrders={async () => {
  if (userProfile) {
    await loadEmployeeOrders(userProfile.tenant_id, userProfile.id);
  }
}}
          onDeleteProgressImage={handleDeleteProgressImage}
          onStartWork={handleEmployeeStartWork}
          onStartBreak={handleEmployeeStartBreak}
          onEndBreak={handleEmployeeEndBreak}
          onEndWork={handleEmployeeEndWork}
        />
      );
    }

    if (!loadingData && userProfile && isProjectManager && currentPage === "dashboard") {
      const fullName =
        `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() ||
        session.user.email ||
        "Projektleiter";

      return (
        <ProjectManagerDashboard
  userName={fullName}
  userEmail={session.user.email || ""}
  onLogout={handleLogout}
  onOpenOrders={() => openOrdersListPage("open")}
  onOpenCreateCustomer={openCreateCustomerPage}
  onOpenCreateSiteVisit={() => setCurrentPage("create-site-visit")}
  onOpenMessages={openMessagesPage}
  unreadMessages={unreadMessages}
/>
      );
    }

    const currencyCode = companySettings?.currency || "EUR";
    const currencySymbol = companySettings?.currency_symbol || "{currencySymbol}";

    const defaultInternalHourlyRate =
      companySettings?.default_internal_hourly_rate ??
      companySettings?.default_hourly_rate ??
      0;

    const defaultCustomerHourlyRate =
      companySettings?.default_customer_hourly_rate ??
      companySettings?.default_hourly_rate ??
      0;

    const openQuoteDetail = async (quoteId: number) => {
      if (!userProfile?.tenant_id) return;

      setSelectedQuoteId(quoteId);
      await loadQuoteDetail(quoteId, userProfile.tenant_id);
      setCurrentPage("quote-detail");
    };

    const getCustomerDisplayName = (customerId: number | string) => {
      const customer = customers.find(
        (c) => String(c.id) === String(customerId)
      );

      if (!customer) return `Kunde #${customerId}`;

      if (customer.company_name) {
        return `${customer.company_name} – ${customer.first_name} ${customer.last_name}`;
      }

      return `${customer.first_name} ${customer.last_name}`;
    };

    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <header className="topbar">
            <div className="topbar-left">
              <h1>Maler SaaS Plattform</h1>
              <p className="topbar-subtitle">
                {isAdmin
                  ? "Admin-Dashboard für Kunden, Aufträge und Mitarbeiter"
                  : "Dashboard"}

              </p>
            </div>

            <div className="topbar-right">
              <div className="user-box">
                <span className="user-label">Eingeloggt als</span>
                <strong>{session.user.email}</strong>
                {userProfile && (
                  <span className="user-meta">
                    Rolle-ID: {userProfile.role_id} | Tenant: {userProfile.tenant_id}
                  </span>
                )}
              </div>

              <button onClick={handleLogout} className="btn btn-secondary">
                Logout
              </button>
            </div>
          </header>

          {loadingData && (
            <div className="card">
              <p>Lade Daten...</p>
            </div>
          )}

          {!loadingData && !userProfile && (
            <div className="card">
              <h2>Benutzerprofil nicht gefunden</h2>
              <p>
                In <code>app_users</code> wurde kein Datensatz zum eingeloggten
                Supabase-User gefunden.
              </p>
            </div>
          )}

          {!loadingData && userProfile && (
            <>

{currentPage === "dashboard" && userProfile?.role_id === 1 && (
  <PlatformOwnerDashboard onBack={openDashboard} />
)}

              {currentPage === "dashboard" && isAdmin && userProfile?.role_id !== 1 && (
                <>
                  <section className="stats-grid stats-grid-5">
                    <button
                      type="button"
                      className="stat-card stat-card-clickable"
                      onClick={openCustomersListPage}
                    >
                      <span className="stat-label">Kunden gesamt</span>
                      <strong className="stat-value">{stats.totalCustomers}</strong>
                    </button>

                    <button
  type="button"
  className="stat-card stat-card-clickable"
  onClick={() => openOrdersListPage("new")}
>
  <span className="stat-label">Aufträge</span>
  <strong className="stat-value">{stats.totalOrders}</strong>
</button>

                    <button
                      type="button"
                      className="stat-card stat-card-clickable"
                      onClick={openEmployeesListPage}
                    >
                      <span className="stat-label">Mitarbeiter</span>
                      <strong className="stat-value">{stats.totalEmployees}</strong>
                    </button>

                    <button
                      type="button"
                      className="stat-card stat-card-clickable"
                      onClick={() => setCurrentPage("invoices-list")}
                    >
                      <span className="stat-label">Rechnungen</span>
                      <strong className="stat-value">{stats.totalInvoices}</strong>
                    </button>

                  </section>

                  <section className="action-bar">
  {canCreateCustomers && (
    <button
      type="button"
      className="btn btn-success"
      onClick={openCreateCustomerPage}
    >
      + Kunde anlegen
    </button>
  )}

  {isAdmin && (
    <button
      type="button"
      className="btn btn-success"
      onClick={openCreateEmployeePage}
    >
      + Mitarbeiter anlegen
    </button>
  )}

  <button
    type="button"
    className="btn btn-success"
    onClick={() => setCurrentPage("create-site-visit")}
  >
    + Besichtigung anlegen
  </button>

  <button
    type="button"
    className="btn btn-primary"
    onClick={() => setCurrentPage("quotes-list")}
  >
    Angebote
  </button>

  <button
    type="button"
    className="btn btn-primary"
    onClick={() => setCurrentPage("invoices-list")}
  >
    Rechnungen
  </button>

  <button
    type="button"
    className="btn btn-primary"
    onClick={() => setCurrentPage("time-evaluation")}
  >
    Arbeitsstunden
  </button>

  <button
    type="button"
    className="btn btn-primary"
    onClick={openMessagesPage}
  >
    Nachrichten {unreadMessages > 0 ? `(${unreadMessages})` : ""}
  </button>

  <button
    type="button"
    className="btn btn-warning"
    onClick={() => setCurrentPage("settings")}
  >
    Einstellungen
  </button>

  <button
    type="button"
    className="btn btn-warning"
    onClick={() => setCurrentPage("pricing-rules")}
  >
    Preisregeln
  </button>
</section>
                </>
              )}

              {currentPage === "create-site-visit" && canAccessSiteVisit && (
                <section className="single-page-section">
                  <div className="card form-page-card">
                    <div className="page-topbar">
                      <div className="site-visit-header">
                        <div>
                          <span className="site-visit-kicker">Besichtigung</span>
                          <h2>Aufmaß erfassen</h2>
                          <p>
                            Räume, Fenster, Türen, Heizkörper und Sonderleistungen strukturiert erfassen.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={openDashboard}
                        >
                          Zurück zum Dashboard
                        </button>
                      </div>


                    </div>

                    <form
                      onSubmit={handleCreateSiteVisit}
                      className="form-stack site-visit-form"
                    >
                      <div
                        style={{
                          background: "linear-gradient(135deg, #f8fbff 0%, #eef4ff 100%)",
                          border: "1px solid #d8e4f5",
                          borderRadius: "18px",
                          padding: "18px",
                          marginBottom: "20px",
                          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "16px",
                            flexWrap: "wrap",
                            marginBottom: "14px",
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                margin: 0,
                                fontSize: "18px",
                                fontWeight: 700,
                                color: "#1e3a5f",
                              }}
                            >
                              Live-Zusammenfassung
                            </h3>
                            <p
                              style={{
                                margin: "6px 0 0 0",
                                fontSize: "13px",
                                lineHeight: 1.45,
                                color: "#5b6b7f",
                              }}
                            >
                              Aktueller Stand der Besichtigung auf einen Blick.
                            </p>
                          </div>

                          <div
                            style={{
                              padding: "9px 13px",
                              borderRadius: "999px",
                              background: "#ffffff",
                              border: "1px solid #d9e5f6",
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "#23415f",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Bereiche: {roomsCount}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: "12px",
                          }}
                        >
                          <div
                            style={{
                              background: "#ffffff",
                              borderRadius: "14px",
                              padding: "12px 14px",
                              border: "1px solid #e3ebf7",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                marginBottom: "4px",
                              }}
                            >
                              Fenster
                            </div>
                            <div
                              style={{
                                fontSize: "22px",
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              {windowsCount}
                            </div>
                          </div>

                          <div
                            style={{
                              background: "#ffffff",
                              borderRadius: "14px",
                              padding: "12px 14px",
                              border: "1px solid #e3ebf7",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                marginBottom: "4px",
                              }}
                            >
                              Türen
                            </div>
                            <div
                              style={{
                                fontSize: "22px",
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              {doorsCount}
                            </div>
                          </div>

                          <div
                            style={{
                              background: "#ffffff",
                              borderRadius: "14px",
                              padding: "12px 14px",
                              border: "1px solid #e3ebf7",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                marginBottom: "4px",
                              }}
                            >
                              Heizkörper
                            </div>
                            <div
                              style={{
                                fontSize: "22px",
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              {radiatorsCount}
                            </div>
                          </div>

                          <div
                            style={{
                              background: "#ffffff",
                              borderRadius: "14px",
                              padding: "12px 14px",
                              border: "1px solid #e3ebf7",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                marginBottom: "4px",
                              }}
                            >
                              Sonderleistungen
                            </div>
                            <div
                              style={{
                                fontSize: "22px",
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              {customServicesCount}
                            </div>
                          </div>

                          <div
                            style={{
                              background: "#ffffff",
                              borderRadius: "14px",
                              padding: "12px 14px",
                              border: "1px solid #e3ebf7",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                marginBottom: "4px",
                              }}
                            >
                              Std. Sonderleistungen
                            </div>
                            <div
                              style={{
                                fontSize: "22px",
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              {customServicesHours}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="settings-section">
                        <div
                          onClick={() => toggleSection("general")}
                          style={{
                            background: "#e8f0fe",
                            padding: "12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            marginBottom: "10px",
                          }}
                        >
                          <h3 style={{ margin: 0 }}>
                            Besichtigungsdaten {openSections.general ? "▼" : "▶"}
                          </h3>
                        </div>

                        {openSections.general && (
                          <>

                            <div className="form-group">
                              <label>Kunde</label>
                              <select
                                name="customer_id"
                                value={siteVisitForm.customer_id}
                                onChange={(e) => {
                                  handleSiteVisitChange(e);
                                  loadSiteVisitsForCustomer(e.target.value);
                                }}
                                required
                              >
                                <option value="">Bitte wählen</option>
                                {customers.map((customer) => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.company_name
                                      ? `${customer.company_name} – ${customer.first_name} ${customer.last_name}`
                                      : `${customer.first_name} ${customer.last_name}`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {availableSiteVisits.length > 0 && (
                              <div className="form-group">
                                <label>Gespeicherte Besichtigung wählen</label>

                                <select
                                  value={selectedSiteVisitId ?? ""}
                                  onChange={(e) => {
                                    const id = e.target.value ? Number(e.target.value) : null;
                                    setSelectedSiteVisitId(id);

                                    if (id) {
                                      loadSiteVisitForEditing(id);
                                    }
                                  }}
                                >
                                  <option value="">Bitte Besichtigung wählen</option>

                                  {availableSiteVisits.map((visit) => (
                                    <option key={visit.id} value={visit.id}>
                                      {visit.visit_number || `ID ${visit.id}`} – {visit.title}
                                      {visit.visit_date ? ` – ${visit.visit_date}` : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {loadingSiteVisits && (
                              <p className="info-text">Besichtigungen werden geladen...</p>
                            )}

                            <div className="form-group">
                              <label>Titel</label>
                              <input
                                type="text"
                                name="title"
                                value={siteVisitForm.title}
                                onChange={handleSiteVisitChange}
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label>Straße</label>
                              <input
                                type="text"
                                name="object_street"
                                value={siteVisitForm.object_street}
                                onChange={handleSiteVisitChange}
                              />
                            </div>

                            <div className="form-row two-cols">
                              <div className="form-group">
                                <label>PLZ</label>
                                <input
                                  type="text"
                                  name="object_zip"
                                  value={siteVisitForm.object_zip}
                                  onChange={handleSiteVisitChange}
                                />
                              </div>

                              <div className="form-group">
                                <label>Ort</label>
                                <input
                                  type="text"
                                  name="object_city"
                                  value={siteVisitForm.object_city}
                                  onChange={handleSiteVisitChange}
                                />
                              </div>

                            </div>

                            <div className="form-group">
                              <label>Besichtigungsdatum</label>
                              <input
                                type="date"
                                name="visit_date"
                                value={siteVisitForm.visit_date}
                                onChange={handleSiteVisitChange}
                              />
                            </div>

                            <div className="form-group">
                              <label>Notizen</label>
                              <textarea
                                name="notes"
                                value={siteVisitForm.notes}
                                onChange={handleSiteVisitChange}
                                rows={4}
                              />
                            </div>
                          </>
                        )}
                      </div>


                      <div className="settings-section">
                        <div
                          onClick={() => toggleSection("rooms")}
                          style={{
                            background: "#eaf7ff",
                            padding: "12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            marginBottom: "10px",
                          }}
                        >
                          <h3 style={{ margin: 0 }}>
                            Bereiche {openSections.rooms ? "▼" : "▶"}
                          </h3>
                          <p style={{ margin: "6px 0 0 0" }}>
                            Hier werden die Grundmaße der Bereiche erfasst.
                          </p>
                        </div>

                        {openSections.rooms && (
                          <>
                            {siteVisitForm.rooms.map((room, index) => (
                              <div key={room.temp_id} className="site-visit-room-card">
                                <div className="site-visit-room-header">
                                  <div>
                                    <span className="room-card-kicker">Bereich {index + 1}</span>
                                    <h4>
                                      {room.room_name?.trim()
                                        ? room.room_name
                                        : `Unbenannter Bereich ${index + 1}`}
                                    </h4>
                                  </div>

                                  {siteVisitForm.rooms.length > 1 && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary room-remove-btn"
                                      onClick={() => removeRoom(room.temp_id)}
                                    >
                                      Entfernen
                                    </button>
                                  )}
                                </div>

                                <div className="room-card-grid">
                                  <div className="form-group">
                                    <label>Bezeichnung</label>
                                    <input
                                      type="text"
                                      value={room.room_name}
                                      onChange={(e) =>
                                        updateRoom(room.temp_id, "room_name", e.target.value)
                                      }
                                      placeholder="z. B. Wohnzimmer, Garage, Fassade, Gartenzaun"
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Decke streichen</label>
                                    <select
                                      value={room.paint_ceiling ? "true" : "false"}
                                      onChange={(e) =>
                                        updateRoom(
                                          room.temp_id,
                                          "paint_ceiling",
                                          e.target.value === "true"
                                        )
                                      }
                                    >
                                      <option value="true">Ja</option>
                                      <option value="false">Nein</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="form-row three-cols">
                                  <div className="form-group">
                                    <label>Länge (m)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={room.length_m}
                                      onChange={(e) =>
                                        updateRoom(room.temp_id, "length_m", e.target.value)
                                      }
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Breite (m)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={room.width_m}
                                      onChange={(e) =>
                                        updateRoom(room.temp_id, "width_m", e.target.value)
                                      }
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Höhe (m)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={room.height_m}
                                      onChange={(e) =>
                                        updateRoom(room.temp_id, "height_m", e.target.value)
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="room-elements-summary">

                                  <div
                                    className="room-element clickable"
                                    onClick={() => {
                                      setOpenSections((prev) => ({
                                        ...prev,
                                        windows: true,
                                      }));

                                      addWindow(room.temp_id);

                                      setTimeout(() => {
                                        document
                                          .getElementById("windows-section")
                                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                      }, 100);
                                    }}
                                  >
                                    🪟 Fenster ·{" "}
                                    {
                                      siteVisitForm.windows
                                        .filter((w) => String(w.room_temp_id) === String(room.temp_id))
                                        .reduce((sum, w) => sum + (Number(w.count_items) || 0), 0)
                                    }
                                  </div>

                                  <div
                                    className="room-element clickable"
                                    onClick={() => {
                                      setOpenSections((prev) => ({
                                        ...prev,
                                        doors: true,
                                      }));

                                      addDoor(room.temp_id);

                                      setTimeout(() => {
                                        document
                                          .getElementById("doors-section")
                                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                      }, 100);
                                    }}
                                  >
                                    🚪 Türen ·{" "}
                                    {
                                      siteVisitForm.doors
                                        .filter((d) => String(d.room_temp_id) === String(room.temp_id))
                                        .reduce((sum, d) => sum + (Number(d.count_items) || 0), 0)
                                    }
                                  </div>

                                  <div
                                    className="room-element clickable"
                                    onClick={() => {
                                      setOpenSections((prev) => ({
                                        ...prev,
                                        radiators: true,
                                      }));

                                      addRadiator(room.temp_id);

                                      setTimeout(() => {
                                        document
                                          .getElementById("radiators-section")
                                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                      }, 100);
                                    }}
                                  >
                                    🔥 Heizkörper ·{" "}
                                    {
                                      siteVisitForm.radiators
                                        .filter((r) => String(r.room_temp_id) === String(room.temp_id))
                                        .reduce((sum, r) => sum + (Number(r.count_items) || 0), 0)
                                    }
                                  </div>

                                </div>

                                <div className="manual-wall-box">
                                  <label>Manuelle Wandfläche (m²)</label>
                                  <input
                                    type="number"
                                    placeholder="z. B. 16.8"
                                    value={room.manual_wall_area_sqm}
                                    onChange={(e) =>
                                      updateRoom(room.temp_id, "manual_wall_area_sqm", e.target.value)
                                    }
                                  />
                                  <small>
                                    Wenn ausgefüllt, wird diese Fläche statt der automatischen Berechnung verwendet.
                                  </small>
                                </div>

                                <div className="room-image-upload-box">
                                  <label>Fotos zum Bereich</label>

                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) =>
                                      handleRoomImagesSelected(room.temp_id, e.target.files)
                                    }
                                  />
                                  {(savedRoomImages[Number(room.temp_id)]?.length || 0) > 0 && (
                                    <div className="room-image-preview-grid">
                                      {savedRoomImages[Number(room.temp_id)].map((image) => (
                                        <div key={image.file_path} className="room-image-preview">
                                          <img
                                            src={image.signedUrl}
                                            alt={image.file_name || "Gespeichertes Foto"}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {(roomImages[room.temp_id]?.length || 0) > 0 && (
                                    <div className="room-image-preview-grid">
                                      {roomImages[room.temp_id].map((image, imageIndex) => (
                                        <div key={imageIndex} className="room-image-preview">
                                          <img src={image.previewUrl} alt={`Bereich Foto ${imageIndex + 1}`} />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="form-group">
                                  <label>Notiz</label>
                                  <textarea
                                    rows={3}
                                    value={room.notes}
                                    onChange={(e) => updateRoom(room.temp_id, "notes", e.target.value)}
                                  />
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>

                      <div className="settings-section" id="windows-section">
                        <div
                          onClick={() => toggleSection("windows")}
                          style={{
                            background: "#edf9f1",
                            padding: "12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            marginBottom: "10px",
                          }}
                        >
                          <h3 style={{ margin: 0 }}>
                            Fenster {openSections.windows ? "▼" : "▶"}
                          </h3>
                        </div>

                        {openSections.windows && (
                          <>
                            <div className="page-topbar">
                              <div>
                                <h4>Fenster</h4>
                              </div>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => addWindow()}
                              >
                                Fenster hinzufügen
                              </button>
                            </div>

                            {siteVisitForm.windows.map((item, index) => (
                              <div key={item.temp_id} className="settings-section" style={{ marginTop: "16px" }}>
                                <div className="page-topbar">
                                  <div>
                                    <h4>Fenster {index + 1}</h4>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => removeWindow(item.temp_id)}
                                  >
                                    Entfernen
                                  </button>
                                </div>

                                <div className="form-row three-cols">
                                  <div className="form-group">
                                    <label>Raum</label>
                                    <select
                                      value={item.room_temp_id ?? ""}
                                      onChange={(e) => updateWindow(item.temp_id, "room_temp_id", e.target.value)}
                                    >
                                      <option value="">Bitte wählen</option>
                                      {siteVisitForm.rooms.map((room, roomIndex) => (
                                        <option key={room.temp_id} value={room.temp_id}>
                                          {room.room_name?.trim() ? room.room_name : `Bereich ${roomIndex + 1}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="form-group">
                                    <label>Anzahl</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.count_items}
                                      onChange={(e) => updateWindow(item.temp_id, "count_items", e.target.value)}
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Breite (m)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.width_m}
                                      onChange={(e) => updateWindow(item.temp_id, "width_m", e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="form-row two-cols">
                                  <div className="form-group">
                                    <label>Höhe (m)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.height_m}
                                      onChange={(e) => updateWindow(item.temp_id, "height_m", e.target.value)}
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Notiz</label>
                                    <input
                                      type="text"
                                      value={item.notes}
                                      onChange={(e) => updateWindow(item.temp_id, "notes", e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>

                      <div className="settings-section" id="doors-section">
                        <div
                          onClick={() => toggleSection("doors")}
                          style={{
                            background: "#fff4e8",
                            padding: "12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            marginBottom: "10px",
                          }}
                        >
                          <h3 style={{ margin: 0 }}>
                            Türen {openSections.doors ? "▼" : "▶"}
                          </h3>
                        </div>

                        {openSections.doors && (
                          <>
                            <div className="page-topbar">
                              <div>
                                <h4>Türen</h4>
                              </div>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => addDoor()}
                              >
                                Tür hinzufügen
                              </button>
                            </div>

                            {siteVisitForm.doors.map((item, index) => (
                              <div key={item.temp_id} className="settings-section" style={{ marginTop: "16px" }}>
                                <div className="page-topbar">
                                  <div>
                                    <h4>Tür {index + 1}</h4>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => removeDoor(item.temp_id)}
                                  >
                                    Entfernen
                                  </button>
                                </div>

                                <div className="form-row three-cols">
                                  <div className="form-group">
                                    <label>Raum</label>
                                    <select
                                      value={item.room_temp_id ?? ""}
                                      onChange={(e) => updateDoor(item.temp_id, "room_temp_id", e.target.value)}
                                    >
                                      <option value="">Bitte wählen</option>
                                      {siteVisitForm.rooms.map((room, roomIndex) => (
                                        <option key={room.temp_id} value={room.temp_id}>
                                          {room.room_name?.trim() ? room.room_name : `Bereich ${roomIndex + 1}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="form-group">
                                    <label>Anzahl</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.count_items}
                                      onChange={(e) => updateDoor(item.temp_id, "count_items", e.target.value)}
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Breite (m)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.width_m}
                                      onChange={(e) => updateDoor(item.temp_id, "width_m", e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="form-row three-cols">
                                  <div className="form-group">
                                    <label>Höhe (m)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.height_m}
                                      onChange={(e) => updateDoor(item.temp_id, "height_m", e.target.value)}
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Zarge enthalten</label>
                                    <select
                                      value={item.frame_included ? "true" : "false"}
                                      onChange={(e) =>
                                        updateDoor(item.temp_id, "frame_included", e.target.value === "true")
                                      }
                                    >
                                      <option value="true">Ja</option>
                                      <option value="false">Nein</option>
                                    </select>
                                  </div>

                                  <div className="form-group">
                                    <label>Notiz</label>
                                    <input
                                      type="text"
                                      value={item.notes}
                                      onChange={(e) => updateDoor(item.temp_id, "notes", e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>

                      <div className="settings-section" id="radiators-section">
                        <div
                          onClick={() => toggleSection("radiators")}
                          style={{
                            background: "#fdeeee",
                            padding: "12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            marginBottom: "10px",
                          }}
                        >
                          <h3 style={{ margin: 0 }}>
                            Heizkörper {openSections.radiators ? "▼" : "▶"}
                          </h3>
                        </div>

                        {openSections.radiators && (
                          <>
                            <div className="page-topbar">
                              <div>
                                <h4>Heizkörper</h4>
                              </div>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => addRadiator()}
                              >
                                Heizkörper hinzufügen
                              </button>
                            </div>

                            {siteVisitForm.radiators.map((item, index) => (
                              <div
                                key={item.temp_id}
                                className="settings-section"
                                style={{ marginTop: "16px" }}
                              >
                                <div className="page-topbar">
                                  <div>
                                    <h4>Heizkörper {index + 1}</h4>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => removeRadiator(item.temp_id)}
                                  >
                                    Entfernen
                                  </button>
                                </div>

                                <div className="form-row three-cols">
                                  <div className="form-group">
                                    <label>Raum</label>
                                    <select
                                      value={item.room_temp_id ?? ""}
                                      onChange={(e) =>
                                        updateRadiator(item.temp_id, "room_temp_id", e.target.value)
                                      }
                                    >
                                      <option value="">Bitte wählen</option>
                                      {siteVisitForm.rooms.map((room, roomIndex) => (
                                        <option key={room.temp_id} value={room.temp_id}>
                                          {room.room_name?.trim() ? room.room_name : `Bereich ${roomIndex + 1}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="form-group">
                                    <label>Anzahl</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.count_items}
                                      onChange={(e) =>
                                        updateRadiator(item.temp_id, "count_items", e.target.value)
                                      }
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Breite (m)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.width_m}
                                      onChange={(e) =>
                                        updateRadiator(item.temp_id, "width_m", e.target.value)
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="form-row three-cols">
                                  <div className="form-group">
                                    <label>Höhe (m)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.height_m}
                                      onChange={(e) =>
                                        updateRadiator(item.temp_id, "height_m", e.target.value)
                                      }
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Typ</label>
                                    <input
                                      type="text"
                                      value={item.radiator_type}
                                      onChange={(e) =>
                                        updateRadiator(item.temp_id, "radiator_type", e.target.value)
                                      }
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Notiz</label>
                                    <input
                                      type="text"
                                      value={item.notes}
                                      onChange={(e) =>
                                        updateRadiator(item.temp_id, "notes", e.target.value)
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>

                      <div className="settings-section">
                        <div
                          onClick={() => toggleSection("custom")}
                          style={{
                            background: "#fff7ed",
                            padding: "12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            marginBottom: "10px",
                          }}
                        >
                          <h3 style={{ margin: 0 }}>
                            Sonderleistungen {openSections.custom ? "▼" : "▶"}
                          </h3>
                        </div>

                        {openSections.custom && (
                          <>
                            <p>Zusätzliche Leistungen, die per Stundenlohn abgerechnet werden.</p>

                            {siteVisitForm.custom_services.length === 0 ? (
                              <p className="info-text">Noch keine Sonderleistungen erfasst.</p>
                            ) : (
                              siteVisitForm.custom_services.map((item, index) => (
                                <div
                                  key={item.temp_id}
                                  className="settings-section"
                                  style={{ marginTop: "16px" }}
                                >
                                  <div className="page-topbar">
                                    <div>
                                      <h4>Sonderleistung {index + 1}</h4>
                                    </div>

                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={() => removeCustomService(item.temp_id)}
                                    >
                                      Entfernen
                                    </button>
                                  </div>

                                  <div className="form-group">
                                    <label>Bezeichnung</label>
                                    <input
                                      type="text"
                                      value={item.title}
                                      onChange={(e) =>
                                        updateCustomService(item.temp_id, "title", e.target.value)
                                      }
                                      placeholder="z. B. Garten – Rasen mähen"
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Beschreibung</label>
                                    <textarea
                                      rows={3}
                                      value={item.description}
                                      onChange={(e) =>
                                        updateCustomService(
                                          item.temp_id,
                                          "description",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Stunden</label>
                                    <input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      value={item.hours}
                                      onChange={(e) =>
                                        updateCustomService(item.temp_id, "hours", e.target.value)
                                      }
                                      placeholder="z. B. 3"
                                    />
                                  </div>
                                </div>
                              ))
                            )}
                          </>
                        )}
                      </div>
                      <div className="site-visit-sticky-bar">
                        <div className="site-visit-sticky-inner">
                          <div className="site-visit-sticky-left">
                            {editingSiteVisitId && (
                              <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleDeleteSiteVisit}
                              >
                                Besichtigung löschen
                              </button>
                            )}
                          </div>

                          {/* Desktop */}
                          <div className="site-visit-desktop-actions">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={addRoom}
                            >
                              Bereich hinzufügen
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={addCustomService}
                            >
                              Sonderleistung
                            </button>

                            <button
                              type="submit"
                              className="btn btn-primary"
                              disabled={savingSiteVisit}
                              onClick={() => setCreateQuoteAfterSave(false)}
                            >
                              {savingSiteVisit ? "Speichert..." : "Speichern"}
                            </button>

                            {(isAdmin || isProjectManager) && (
  <button
    type="submit"
    className="btn btn-secondary"
    disabled={savingSiteVisit}
    onClick={() => setCreateQuoteAfterSave(true)}
  >
    Angebot
  </button>
)}
                          </div>

                          {/* Mobile */}
                          <div className="site-visit-mobile-actions">
                            <button
                              type="submit"
                              className="btn btn-primary"
                              disabled={savingSiteVisit}
                              onClick={() => setCreateQuoteAfterSave(false)}
                            >
                              Speichern
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() =>
                                setMobileSiteVisitMenuOpen(!mobileSiteVisitMenuOpen)
                              }
                            >
                              ☰ Mehr
                            </button>

                            {mobileSiteVisitMenuOpen && (
                              <div className="site-visit-mobile-menu">
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={addRoom}
                                >
                                  + Bereich
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={addCustomService}
                                >
                                  + Sonderleistung
                                </button>

                                {(userProfile?.role_id === 1 ||
                                  userProfile?.role_id === 2) && (
                                    <button
                                      type="submit"
                                      className="btn btn-secondary"
                                      onClick={() => setCreateQuoteAfterSave(true)}
                                    >
                                      Angebot
                                    </button>
                                  )}

                                {editingSiteVisitId && (
                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={handleDeleteSiteVisit}
                                  >
                                    Löschen
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {siteVisitMessage && <p className="info-text">{siteVisitMessage}</p>}

                    </form>
                  </div>
                </section>
              )}

              {currentPage === "customers-list" && canViewCustomers && (
                <section className="single-page-section">
                  <div className="card">
                    <div className="page-topbar">
                      <div>
                        <h2>Kundenliste</h2>
                        <p>Alle Kunden des aktuellen Tenants auf einen Blick.</p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={openDashboard}
                      >
                        Zurück zum Dashboard
                      </button>
                    </div>

                    <div className="list-toolbar">
                      <input
                        type="text"
                        placeholder="Kunden suchen..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="search-input"
                      />
                    </div>

                    {customerMessage && <p className="info-text">{customerMessage}</p>}

                    {filteredCustomers.length === 0 ? (
                      <div className="empty-state">
                        <p>
                          {customers.length === 0
                            ? "Noch keine Kunden vorhanden."
                            : "Keine Kunden zur Suche gefunden."}
                        </p>
                      </div>
                    ) : (
                      <div className="list-grid two-col-list-grid">
                        {filteredCustomers.map((customer) => (
                          <div
                            key={customer.id}
                            className={`customer-item customer-item-row ${selectedCustomerId === customer.id ? "customer-item-active" : ""
                              }`}
                          >
                            <div
                              className="customer-content customer-clickable"
                              onClick={() => handleSelectCustomer(customer)}
                            >
                              {customer.company_name && (
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.95rem",
                                    color: "#374151",
                                    marginBottom: "2px",
                                  }}
                                >
                                  {customer.company_name}
                                </div>
                              )}
                              <div className="customer-name">
                                {customer.first_name} {customer.last_name}
                              </div>

                              <div className="customer-meta">
                                <span>{customer.email || "Keine E-Mail"}</span>
                                <span>{customer.phone || "Kein Telefon"}</span>
                                <span>
                                  {[customer.street, customer.zip, customer.city]
                                    .filter(Boolean)
                                    .join(", ") || "Keine Adresse"}
                                </span>
                              </div>
                            </div>

                            <div className="customer-actions">
                              {canEditCustomers && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-small"
                                  onClick={() => openEditCustomerPage(customer)}
                                >
                                  Bearbeiten
                                </button>
                              )}

                              {canDeleteCustomers && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-small"
                                  onClick={() => handleDeleteCustomer(customer.id)}
                                  disabled={deletingCustomerId === customer.id}
                                >
                                  {deletingCustomerId === customer.id ? "Löscht..." : "Löschen"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {currentPage === "orders-list" && canViewOrders && (
                <section className="single-page-section">
                  <div className="card">
                    <div className="page-topbar">
                      <div>
                        <h2>{getOrdersListTitle()}</h2>
                        <p>{getOrdersListDescription()}</p>
                      </div>

                      <div className="topbar-actions-inline">
                        {ordersFilterMode === "customer" && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              clearCustomerFilter();
                              openOrdersListPage("all");
                            }}
                          >
                            Kundenfilter zurücksetzen
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={openDashboard}
                        >
                          Zurück zum Dashboard
                        </button>
                      </div>
                    </div>

                    <div className="list-toolbar">
                      <input
                        type="text"
                        placeholder="Aufträge suchen..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="search-input"
                      />

                            <select
    value={ordersFilterMode}
    onChange={(e) =>
      openOrdersListPage(
        e.target.value as "all" | "open" | "completed"
      )
    }
    className="search-input"
  >
    <option value="all">Alle Aufträge</option>
<option value="open">Offene Aufträge</option>
<option value="finished">Fertige Aufträge</option>
<option value="billed">Abgerechnete Aufträge</option>
<option value="completed">Fertig + abgerechnet</option>
  </select>

                      <select
                        value={selectedEmployeeFilterId}
                        onChange={(e) => setSelectedEmployeeFilterId(e.target.value)}
                        className="search-input"
                      >
                        <option value="">Alle Mitarbeiter</option>
                        <option value="unassigned">Nur nicht zugewiesen</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={String(employee.id)}>
                            {(employee.first_name || "").trim()} {(employee.last_name || "").trim()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {orderMessage && <p className="info-text">{orderMessage}</p>}

                    {filteredOrders.length === 0 ? (
                      <div className="empty-state">
                        <p>Keine Aufträge gefunden.</p>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table className="orders-table orders-table-wide">
                          <thead>
                            <tr>
                              <th>Titel</th>
                              <th>Kunde</th>
                              <th>Mitarbeiter</th>
                              <th>Status</th>
                              <th>Ort</th>
                              <th>Zeitraum</th>
                              <th>Aktion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOrders.map((order) => {
                              const orderProgressEntries = getProgressEntriesForOrder(order.id);

                              return (
                                <tr key={order.id}>
                                  <td>
                                    <div className="table-title">{order.title}</div>
                                    <div className="table-subtitle">
                                      {order.description || "Keine Beschreibung"}
                                    </div>

                                    <div style={{ marginTop: "0.75rem" }}>
                                      <strong>Fortschrittsverlauf:</strong>

                                      {orderProgressEntries.length === 0 ? (
                                        <div className="table-subtitle" style={{ marginTop: "0.35rem" }}>
                                          Noch keine Fortschrittsnotizen vorhanden.
                                        </div>
                                      ) : (
                                        <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.5rem" }}>
                                          {orderProgressEntries.map((entry) => (
                                            <div
                                              key={entry.id}
                                              style={{
                                                padding: "0.6rem",
                                                border: "1px solid #e5e7eb",
                                                borderRadius: "8px",
                                                background: "#fafafa",
                                              }}
                                            >
                                              <div className="table-subtitle" style={{ marginBottom: "0.25rem" }}>
                                                {employeeNameMap.get(entry.user_id) ||
                                                  `Mitarbeiter #${entry.user_id}`}{" "}
                                                {formatDateTime(entry.created_at)}
                                              </div>
                                              <div>{entry.note}</div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  <td>
                                    {customerNameMap.get(order.customer_id) || order.customer_id}
                                  </td>

                                  <td
  dangerouslySetInnerHTML={{
    __html: orderEmployeeNamesMap.get(String(order.id)) || "Nicht zugewiesen",
  }}
/>

                                  <td>
                                    <span className={getStatusClass(order.status)}>
  {order.status === "zur_pruefung"
    ? "🔎 Zur Prüfung"
    : order.status.replaceAll("_", " ")}
</span>
                                  </td>

                                  <td>
                                    {[order.address_street, order.address_zip, order.address_city]
                                      .filter(Boolean)
                                      .join(", ") || "-"}
                                  </td>

                                  <td>
                                    {formatDateOnly(order.start_date)} bis {formatDateOnly(order.end_date)}
                                  </td>

                                  <td>
  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
    {canEditOrders && (
      <button
        type="button"
        className="btn btn-secondary btn-small"
        onClick={() => openEditOrderPage(order)}
      >
        Bearbeiten
      </button>
    )}

    {order.status === "zur_pruefung" && (
      <button
        type="button"
        className="btn btn-primary btn-small"
        onClick={() => handleApproveOrder(order.id)}
      >
        Freigeben
      </button>
    )}

    {order.status === "fertig" && isAdmin && (
  <button
    type="button"
    className="btn btn-primary btn-small"
    onClick={() => handleCreateInvoice(order.id)}
  >
    🧾 Rechnung erstellen
  </button>
)}

  </div>
</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {currentPage === "quote-detail" && (
                userProfile?.role_id === 1 ||
                userProfile?.role_id === 2
              ) && (
                  <section className="single-page-section">
                    <div className="card">
                      <div className="page-topbar">
                        <div>
                          <h2>Angebotsdetails</h2>
                          <p>Einzelheiten und Positionen des ausgewählten Angebots.</p>
                        </div>

                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
  {quoteDetail && (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() =>
        generateQuotePdf({
  quoteDetail,
  quoteItems,
  companySettings,
  currencySymbol,
  customers,
})
      }
    >
      PDF erstellen
    </button>
  )}

  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
  {quoteDetail?.status !== "accepted" && (
    <button
  type="button"
  className="btn btn-primary"
  onClick={() => setShowAcceptQuoteForm(true)}
>
  Angebot in Auftrag überführen
</button>
  )}

  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => setCurrentPage("quotes-list")}
  >
    Zurück zur Angebotsliste
  </button>
</div>
</div>
                      </div>

                      {loadingQuoteDetail && <p className="info-text">Angebot wird geladen...</p>}
                      {quoteDetailMessage && <p className="info-text">{quoteDetailMessage}</p>}
                    
                    {showAcceptQuoteForm && (
  <div
    className="card"
    style={{
      marginTop: "20px",
      padding: "20px",
      border: "2px solid #dbeafe",
      background: "#f8fbff",
    }}
  >
    <h3 style={{ marginBottom: "20px" }}>
      Auftrag aus Angebot erstellen
    </h3>

    <div className="form-group">
      <label>Projektleiter auswählen</label>
      <select
        value={selectedProjectManagerId}
        onChange={(e) => setSelectedProjectManagerId(e.target.value)}
      >
        <option value="">Bitte wählen</option>

        {employees
          .filter((u) => u.role_id === 3)
          .map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.first_name} {pm.last_name}
            </option>
          ))}
      </select>
    </div>

    <div className="form-group" style={{ marginTop: "20px" }}>
      <label>Mitarbeiter auswählen</label>

      <div
        style={{
          display: "grid",
          gap: "8px",
          marginTop: "10px",
        }}
      >
        {employees
          .filter((u) => u.role_id === 4)
          .map((employee) => (
            <label
              key={employee.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <input
                type="checkbox"
                checked={selectedEmployeeIds.includes(String(employee.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedEmployeeIds([
                      ...selectedEmployeeIds,
                      String(employee.id),
                    ]);
                  } else {
                    setSelectedEmployeeIds(
                      selectedEmployeeIds.filter(
                        (id) => id !== String(employee.id)
                      )
                    );
                  }
                }}
              />

              {employee.first_name} {employee.last_name}
            </label>
          ))}
      </div>
    </div>

    <div
      style={{
        marginTop: "25px",
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleAcceptQuote}
      >
        Auftrag jetzt erstellen
      </button>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setShowAcceptQuoteForm(false)}
      >
        Abbrechen
      </button>
    </div>
  </div>
)}

                      {quoteDetail && (
                        <>
                          <div className="quote-detail-header">
                            <div>
                              <span className="quote-detail-kicker">Angebot</span>
                              <h3>{quoteDetail.quote_number || "Ohne Angebotsnummer"}</h3>
                              <p>{quoteDetail.title}</p>
                            </div>

                            <div className="quote-detail-status">
                              {quoteDetail.status}
                            </div>
                          </div>

                          <div className="quote-detail-info-grid">
                            <div className="quote-info-card">
                              <span>Datum</span>
                              <strong>
                                {quoteDetail.quote_date
                                  ? new Date(quoteDetail.quote_date).toLocaleDateString("de-DE")
                                  : "-"}
                              </strong>
                            </div>

                            <div className="quote-info-card">
                              <span>Kunde</span>
                              <strong>
                                {getCustomerDisplayName(quoteDetail.customer_id)}
                              </strong>
                            </div>

                            <div className="quote-info-card">
                              <span>Adresse</span>
                              <strong>
                                {[
                                  quoteDetail.address_street,
                                  quoteDetail.address_zip,
                                  quoteDetail.address_city,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "-"}
                              </strong>
                            </div>

                            <div className="quote-info-card">
  <span>Gültig bis</span>

  {!editingValidUntil ? (
    <>
      <strong>
  {quoteDetail.valid_until
    ? new Date(quoteDetail.valid_until).toLocaleDateString("de-DE")
    : "-"}
</strong>

      <button
  type="button"
  className="icon-edit-btn"
  onClick={() => setEditingValidUntil(true)}
  title="Datum ändern"
>
  <Pencil size={16} />
</button>
    </>
  ) : (
    <>
      <input
        type="date"
        value={validUntilValue}
        onChange={(e) => setValidUntilValue(e.target.value)}
      />

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: "10px" }}
        onClick={handleSaveValidUntil}
      >
        speichern
      </button>
    </>
  )}
</div>
                          </div>

                          {(quoteDetail.description || quoteDetail.notes) && (
                            <div className="settings-section">
                              <h3>Beschreibung</h3>

                              {quoteDetail.description && (
                                <p>{quoteDetail.description}</p>
                              )}

                              {quoteDetail.notes && (
                                <>
                                  <strong>Notizen</strong>
                                  <p>{quoteDetail.notes}</p>
                                </>
                              )}
                            </div>
                          )}

                          <div className="settings-section">
                            <h3>Positionen nach Bereichen</h3>

                            {quoteItems.length === 0 ? (
                              <p className="info-text">Keine Positionen vorhanden.</p>
                            ) : (
                              <div className="quote-room-groups">
                                {Object.entries(
                                  quoteItems.reduce((groups: Record<string, typeof quoteItems>, item) => {
                                    const [roomNameRaw] = item.title.split("–");
                                    const roomName = roomNameRaw?.trim() || "Sonstige Leistungen";

                                    if (!groups[roomName]) {
                                      groups[roomName] = [];
                                    }

                                    groups[roomName].push(item);
                                    return groups;
                                  }, {})
                                ).map(([roomName, items]) => (
                                  <div key={roomName} className="quote-room-card">
                                    <div className="quote-room-card-header">
                                      <div>
                                        <span>Bereich</span>
                                        <h4>{roomName}</h4>
                                      </div>

                                      <strong>
                                        {items
                                          .reduce((sum, item) => sum + Number(item.line_total || 0), 0)
                                          .toFixed(2)}{" "}
                                        {currencySymbol}
                                      </strong>
                                    </div>

                                    <div className="quote-room-items">
                                      {items.map((item) => {
                                        const parts = item.title.split("–");
                                        const serviceTitle =
                                          parts.length > 1 ? parts.slice(1).join("–").trim() : item.title;

                                        return (
                                          <div key={item.id} className="quote-room-item">
                                            <div>
                                              <strong>{serviceTitle}</strong>
                                              {item.description && <p>{item.description}</p>}
                                            </div>

                                            <div className="quote-room-item-meta">
                                              <span>
                                                {Number(item.quantity || 0).toFixed(2)} {item.unit}
                                              </span>
                                              <span>× {Number(item.unit_price || 0).toFixed(2)} {currencySymbol}</span>
                                              <strong>{Number(item.line_total || 0).toFixed(2)} {currencySymbol}</strong>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="settings-section">
  <h3>Zusatzposition hinzufügen</h3>

  <div className="form-row two-cols">
    <div className="form-group">
      <label>Zusatzposition</label>
      <select
        value={selectedAdditionalPositionId}
        onChange={(e) => setSelectedAdditionalPositionId(e.target.value)}
      >
        <option value="">Bitte wählen</option>
        {additionalQuotePositions
          .filter((position) => position.is_active)
          .map((position) => (
            <option key={position.id} value={position.id}>
              {position.title} – {Number(position.unit_price || 0).toFixed(2)} {currencySymbol}
            </option>
          ))}
      </select>
    </div>

    <div className="form-group" style={{ justifyContent: "end" }}>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleAddAdditionalPositionToQuote}
        disabled={!selectedAdditionalPositionId}
      >
        Zusatzposition hinzufügen
      </button>
    </div>
  </div>
</div>

                          <div className="quote-summary-card">
  <h3>Summen</h3>

  <div className="quote-summary-row">
  <div className="quote-summary-mini">
    <span>Netto vor Rabatt</span>
    <strong>{Number(quoteDetail.subtotal || 0).toFixed(2)} {currencySymbol}</strong>
  </div>

  <div className="quote-summary-mini discount">
    <span>
      Rabatt
      {quoteDetail.discount_type === "percent" &&
        ` (${Number(quoteDetail.discount_value || 0).toFixed(2)} %)`}
    </span>
    <strong>-{Number(quoteDetail.discount_amount || 0).toFixed(2)} {currencySymbol}</strong>
  </div>

  <div className="quote-summary-mini">
    <span>Netto nach Rabatt</span>
    <strong>{Number(quoteDetail.subtotal_after_discount || 0).toFixed(2)} {currencySymbol}</strong>
  </div>

  <div className="quote-summary-mini">
    <span>MwSt {Number(quoteDetail.tax_rate || 0).toFixed(2)} %</span>
    <strong>{Number(quoteDetail.tax_amount || 0).toFixed(2)} {currencySymbol}</strong>
  </div>
</div>

<div className="quote-summary-grand-total">
  <span>Brutto</span>
  <strong>{Number(quoteDetail.total_amount || 0).toFixed(2)} {currencySymbol}</strong>
</div>
</div>
                        </>
                      )}
                    </div>
                  </section>
                )}

              {currentPage === "quotes-list" && (
                userProfile?.role_id === 1 ||
                userProfile?.role_id === 2
              ) && (
                  <section className="single-page-section">
                    <div className="card">
                      <div className="page-topbar">
                        <div>
                          <h2>Angebote</h2>
                          <p>Übersicht über alle erzeugten Angebote.</p>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={openDashboard}
                        >
                          Zurück zum Dashboard
                        </button>
                      </div>

                      {loadingQuotes && <p className="info-text">Angebote werden geladen...</p>}
                      {quotesMessage && <p className="info-text">{quotesMessage}</p>}

                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Angebotsnr.</th>
                              <th>Datum</th>
                              <th>Titel</th>
                              <th>Kunde</th>
                              <th>Netto</th>
                              <th>MwSt</th>
                              <th>Brutto</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quotes.length === 0 ? (
                              <tr>
                                <td colSpan={8}>Keine Angebote vorhanden.</td>
                              </tr>
                            ) : (
                              quotes.map((quote) => (
                                <tr key={quote.id}>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={() => openQuoteDetail(quote.id)}
                                    >
                                      {quote.quote_number || "-"}
                                    </button>
                                  </td>
                                  <td>
                                    {quote.quote_date
                                      ? new Date(quote.quote_date).toLocaleDateString("de-DE")
                                      : "-"}
                                  </td>
                                  <td>{quote.title}</td>
                                  <td>{getCustomerDisplayName(quote.customer_id)}</td>
                                  <td>{quote.subtotal?.toFixed(2) ?? "0.00"}</td>
                                  <td>{quote.tax_amount?.toFixed(2) ?? "0.00"}</td>
                                  <td>{quote.total_amount?.toFixed(2) ?? "0.00"}</td>
                                  <td>{quote.status}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>
                )}

              {currentPage === "employees-list" && isAdmin && (
                <section className="single-page-section">
                  <div className="card">
                    <div className="page-topbar">
                      <div>
                        <h2>Mitarbeiterliste</h2>
                        <p>Alle internen Mitarbeiter</p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={openDashboard}
                      >
                        Zurück zum Dashboard
                      </button>
                    </div>

                    <div className="list-toolbar">
                      <input
                        type="text"
                        placeholder="Mitarbeiter suchen..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        className="search-input"
                      />
                    </div>

                    {employeeMessage && <p className="info-text">{employeeMessage}</p>}

                    {filteredEmployees.length === 0 ? (
                      <div className="empty-state">
                        <p>
                          {employees.length === 0
                            ? "Noch keine Mitarbeiter vorhanden."
                            : "Keine Mitarbeiter zur Suche gefunden."}
                        </p>
                      </div>
                    ) : (
                      <div className="list-grid two-col-list-grid">
                        {filteredEmployees.map((employee) => (
                          <div key={employee.id} className="customer-item customer-item-row">
                            <div className="customer-content">
                              <div className="customer-name">
                                {employee.first_name || ""} {employee.last_name || ""}
                              </div>

                              <div className="customer-meta">
                                <span>{employee.email || "Keine E-Mail"}</span>
                                <span>{employee.phone || "Kein Telefon"}</span>
                                <span>
                                  Rolle:{" "}
                                  {employee.role_id === PROJECT_MANAGER_ROLE_ID
                                    ? "Projektleiter"
                                    : employee.role_id === EMPLOYEE_ROLE_ID
                                      ? "Mitarbeiter"
                                      : `Rolle-ID ${employee.role_id}`}
                                </span>
                                <span>
                                  Stundensatz intern:{" "}
                                  {employee.hourly_rate != null ? `${Number(employee.hourly_rate).toFixed(2)} ${currencySymbol}` : "nicht hinterlegt"}
                                </span>
                              </div>
                            </div>

                            <div className="customer-actions">
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => openEditEmployeePage(employee)}
                              >
                                Bearbeiten
                              </button>

                              <button
                                type="button"
                                className="btn btn-danger btn-small"
                                onClick={() => handleDeleteEmployee(employee.id)}
                                disabled={deletingEmployeeId === employee.id}
                              >
                                {deletingEmployeeId === employee.id ? "Löscht..." : "Löschen"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {currentPage === "assign-order" && canAssignOrders && (
                <AssignOrder
                  orders={orders}
                  employees={employees}
                  onAssign={handleAssignOrder}
                  onBack={openDashboard}
                />
              )}

              {currentPage === "time-evaluation" && (isAdmin || userProfile?.role_id === 3) && (
                <section className="single-page-section">
                  <div className="card">
                    <div className="page-topbar">
                      <div>
                        <h2>Arbeitsstunden</h2>
                        <p>Übersicht über Arbeitszeiten, Pausen und Nettozeiten.</p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={openDashboard}
                      >
                        Zurück zum Dashboard
                      </button>
                    </div>

                    <div style={{ marginBottom: "20px" }}>
                      <p><strong>Währung:</strong> {currencyCode}</p>
                      <p><strong>Symbol:</strong> {currencySymbol}</p>
                      <p><strong>Interner Standard-Stundensatz:</strong> {defaultInternalHourlyRate}</p>
                      <p><strong>Kunden-Stundensatz:</strong> {defaultCustomerHourlyRate}</p>
                      {loadingCompanySettings && (
                        <p><strong>Hinweis:</strong> Einstellungen werden geladen...</p>
                      )}
                    </div>

                    <AdminTimeEvaluation />
                  </div>
                </section>
              )}

              {currentPage === "settings" && userProfile?.tenant_id && (
                <GlobalSettings
                  tenantId={userProfile.tenant_id}
                  onBack={openDashboard}
                />
              )}

              {currentPage === "create-customer" && canCreateCustomers && (
                <section className="single-page-section">
                  <div className="card form-page-card">
                    <div className="page-topbar">
                      <div>
                        <h2>Kunde anlegen</h2>
                        <p>Neuen Kunden erfassen.</p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={openDashboard}
                      >
                        Zurück zum Dashboard
                      </button>
                    </div>

                    <form onSubmit={handleCreateCustomer} className="form-stack">
                      <div className="form-group">
                        <label>Firmenname</label>
                        <input
                          type="text"
                          name="company_name"
                          value={customerForm.company_name}
                          onChange={handleCustomerChange}
                        />
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Vorname</label>
                          <input
                            type="text"
                            name="first_name"
                            value={customerForm.first_name}
                            onChange={handleCustomerChange}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Nachname</label>
                          <input
                            type="text"
                            name="last_name"
                            value={customerForm.last_name}
                            onChange={handleCustomerChange}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>E-Mail</label>
                          <input
                            type="email"
                            name="email"
                            value={customerForm.email}
                            onChange={handleCustomerChange}
                          />
                        </div>

                        <div className="form-group">
                          <label>Telefon</label>
                          <input
                            type="text"
                            name="phone"
                            value={customerForm.phone}
                            onChange={handleCustomerChange}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Straße</label>
                        <input
                          type="text"
                          name="street"
                          value={customerForm.street}
                          onChange={handleCustomerChange}
                        />
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>PLZ</label>
                          <input
                            type="text"
                            name="zip"
                            value={customerForm.zip}
                            onChange={handleCustomerChange}
                          />
                        </div>

                        <div className="form-group">
                          <label>Ort</label>
                          <input
                            type="text"
                            name="city"
                            value={customerForm.city}
                            onChange={handleCustomerChange}
                          />
                        </div>
                      </div>

                      {isAdmin && (
  <div className="settings-section">
    <h3>Kundenrabatt</h3>
    <p>Optionaler Standardrabatt für diesen Kunden.</p>

    <div className="form-row two-cols">
      <div className="form-group">
        <label>Rabattart</label>
        <select
          name="discount_type"
          value={customerForm.discount_type}
          onChange={handleCustomerChange}
        >
          <option value="percent">Prozent (%)</option>
          <option value="amount">Fester Betrag ({currencySymbol})</option>
        </select>
      </div>

      <div className="form-group">
        <label>Rabattwert</label>
        <input
          type="number"
          step="0.01"
          min="0"
          name="discount_value"
          value={customerForm.discount_value}
          onChange={handleCustomerChange}
          placeholder="z. B. 10"
        />
      </div>
    </div>

    <div className="form-group">
      <label>Rabatt-Notiz</label>
      <textarea
        name="discount_note"
        value={customerForm.discount_note}
        onChange={handleCustomerChange}
        rows={2}
        placeholder="z. B. Stammkunde, Sondervereinbarung, Rahmenvertrag"
      />
    </div>
  </div>
)}

                      <div className="form-group">
                        <label>Notizen</label>
                        <textarea
                          name="notes"
                          value={customerForm.notes}
                          onChange={handleCustomerChange}
                          rows={4}
                        />
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={savingCustomer}
                        >
                          {savingCustomer ? "Speichert..." : "Kunde speichern"}
                        </button>
                      </div>

                      {customerMessage && <p className="info-text">{customerMessage}</p>}
                    </form>
                  </div>
                </section>
              )}

              {currentPage === "edit-customer" && canEditCustomers && (
                <section className="single-page-section">
                  <div className="card form-page-card">
                    <div className="page-topbar">
                      <div>
                        <h2>Kunde bearbeiten</h2>
                        <p>Bestehende Kundendaten aktualisieren.</p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={openCustomersListPage}
                      >
                        Zurück zur Kundenliste
                      </button>
                    </div>

                    <form onSubmit={handleUpdateCustomer} className="form-stack">
                      <div className="form-group">
                        <label>Firmenname</label>
                        <input
                          type="text"
                          name="company_name"
                          value={customerForm.company_name}
                          onChange={handleCustomerChange}
                        />
                      </div>
                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Vorname</label>
                          <input
                            type="text"
                            name="first_name"
                            value={customerForm.first_name}
                            onChange={handleCustomerChange}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Nachname</label>
                          <input
                            type="text"
                            name="last_name"
                            value={customerForm.last_name}
                            onChange={handleCustomerChange}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>E-Mail</label>
                          <input
                            type="email"
                            name="email"
                            value={customerForm.email}
                            onChange={handleCustomerChange}
                          />
                        </div>

                        <div className="form-group">
                          <label>Telefon</label>
                          <input
                            type="text"
                            name="phone"
                            value={customerForm.phone}
                            onChange={handleCustomerChange}
                          />
                        </div>
                      </div>


                      <div className="form-group">
                        <label>Straße</label>
                        <input
                          type="text"
                          name="street"
                          value={customerForm.street}
                          onChange={handleCustomerChange}
                        />
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>PLZ</label>
                          <input
                            type="text"
                            name="zip"
                            value={customerForm.zip}
                            onChange={handleCustomerChange}
                          />
                        </div>

                        <div className="form-group">
                          <label>Ort</label>
                          <input
                            type="text"
                            name="city"
                            value={customerForm.city}
                            onChange={handleCustomerChange}
                          />
                        </div>
                      </div>

{isAdmin && (
  <div className="settings-section">
    <h3>Kundenrabatt</h3>
    <p>Optionaler Standardrabatt für diesen Kunden.</p>

    <div className="form-row two-cols">
      <div className="form-group">
        <label>Rabattart</label>
        <select
          name="discount_type"
          value={customerForm.discount_type}
          onChange={handleCustomerChange}
        >
          <option value="percent">Prozent (%)</option>
          <option value="amount">
            Fester Betrag ({currencySymbol})
          </option>
        </select>
      </div>

      <div className="form-group">
        <label>Rabattwert</label>
        <input
          type="number"
          step="0.01"
          min="0"
          name="discount_value"
          value={customerForm.discount_value}
          onChange={handleCustomerChange}
          placeholder="z. B. 10"
        />
      </div>
    </div>

    <div className="form-group">
      <label>Rabatt-Notiz</label>
      <textarea
        name="discount_note"
        value={customerForm.discount_note}
        onChange={handleCustomerChange}
        rows={2}
        placeholder="z. B. Stammkunde, Sondervereinbarung, Rahmenvertrag"
      />
    </div>
  </div>
)}
                      <div className="form-group">
                        <label>Notizen</label>
                        <textarea
                          name="notes"
                          value={customerForm.notes}
                          onChange={handleCustomerChange}
                          rows={4}
                        />
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={savingCustomer}
                        >
                          {savingCustomer ? "Speichert..." : "Änderungen speichern"}
                        </button>
                      </div>

                      {customerMessage && <p className="info-text">{customerMessage}</p>}
                    </form>
                  </div>
                </section>
              )}

              {currentPage === "create-order" && canCreateOrders && (
                <section className="single-page-section">
                  <div className="card form-page-card">
                    <div className="page-topbar">
                      <div>
                        <h2>Auftrag anlegen</h2>
                        <p>Neuen Auftrag mit Kundenzuordnung speichern.</p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={openDashboard}
                      >
                        Zurück zum Dashboard
                      </button>
                    </div>

                    <form onSubmit={handleCreateOrder} className="form-stack">
                      <div className="form-group">
                        <label>Kunde</label>
                        <select
                          name="customer_id"
                          value={orderForm.customer_id}
                          onChange={handleOrderChange}
                          required
                        >
                          <option value="">Bitte Kunde auswählen</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.first_name} {customer.last_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Mitarbeiter zuweisen</label>
                        <select
                          name="assigned_to"
                          value={orderForm.assigned_to}
                          onChange={handleOrderChange}
                        >
                          <option value="">Kein Mitarbeiter zugewiesen</option>
                          {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.first_name || ""} {employee.last_name || ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Auftragstitel</label>
                        <input
                          type="text"
                          name="title"
                          value={orderForm.title}
                          onChange={handleOrderChange}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Beschreibung</label>
                        <textarea
                          name="description"
                          value={orderForm.description}
                          onChange={handleOrderChange}
                          rows={4}
                        />
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Status</label>
                          <select
                            name="status"
                            value={orderForm.status}
                            onChange={handleOrderChange}
                          >
                            <option value="neu">Neu</option>
                            <option value="geplant">Geplant</option>
                            <option value="in_arbeit">In Arbeit</option>
                            <option value="pausiert">Pausiert</option>
                            <option value="fertig">Fertig</option>
                            <option value="abgerechnet">Abgerechnet</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Straße</label>
                          <input
                            type="text"
                            name="address_street"
                            value={orderForm.address_street}
                            onChange={handleOrderChange}
                          />
                        </div>
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>PLZ</label>
                          <input
                            type="text"
                            name="address_zip"
                            value={orderForm.address_zip}
                            onChange={handleOrderChange}
                          />
                        </div>

                        <div className="form-group">
                          <label>Ort</label>
                          <input
                            type="text"
                            name="address_city"
                            value={orderForm.address_city}
                            onChange={handleOrderChange}
                          />
                        </div>
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Startdatum</label>
                          <input
                            type="date"
                            name="start_date"
                            value={orderForm.start_date}
                            onChange={handleOrderChange}
                          />
                        </div>

                        <div className="form-group">
                          <label>Enddatum</label>
                          <input
                            type="date"
                            name="end_date"
                            value={orderForm.end_date}
                            onChange={handleOrderChange}
                          />
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={savingOrder}
                        >
                          {savingOrder ? "Speichert..." : "Auftrag speichern"}
                        </button>
                      </div>

                      {orderMessage && <p className="info-text">{orderMessage}</p>}
                    </form>
                  </div>
                </section>
              )}

              {currentPage === "edit-order" && canEditOrders && (
                <section className="single-page-section">
                  <div className="card form-page-card">
                    <div className="page-topbar">
                      <div>
                        <h2>Auftrag bearbeiten</h2>
                        <p>Bestehende Auftragsdaten aktualisieren.</p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openOrdersListPage(ordersFilterMode)}
                      >
                        Zurück zur Auftragsliste
                      </button>
                    </div>

                    <form onSubmit={handleUpdateOrder} className="form-stack">
                      <div className="form-group">
                        <label>Kunde</label>
                        <select
                          name="customer_id"
                          value={orderForm.customer_id}
                          onChange={handleOrderChange}
                          required
                        >
                          <option value="">Bitte Kunde auswählen</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.first_name} {customer.last_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
  <label>Projektleiter</label>
  <select
    value={selectedProjectManagerId}
    onChange={(e) => setSelectedProjectManagerId(e.target.value)}
  >
    <option value="">Bitte wählen</option>
    {employees
  .filter((pm) => pm.role_id === 3)
  .map((pm) => (
      <option key={pm.id} value={pm.id}>
        {pm.first_name || ""} {pm.last_name || ""}
      </option>
    ))}
  </select>
</div>

<div className="form-group">
  <label>Mitarbeiter zuweisen</label>

  <div
    style={{
      display: "grid",
      gap: "8px",
      marginTop: "10px",
    }}
  >
    {employees.map((employee) => (
      <label
        key={employee.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={selectedEmployeeIds.includes(String(employee.id))}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedEmployeeIds([
                ...selectedEmployeeIds,
                String(employee.id),
              ]);
            } else {
              setSelectedEmployeeIds(
                selectedEmployeeIds.filter(
                  (id) => id !== String(employee.id)
                )
              );
            }
          }}
        />

        {employee.first_name || ""} {employee.last_name || ""}
      </label>
    ))}
  </div>
</div>

                      <div className="form-group">
                        <label>Auftragstitel</label>
                        <input
                          type="text"
                          name="title"
                          value={orderForm.title}
                          onChange={handleOrderChange}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Beschreibung</label>
                        <textarea
                          name="description"
                          value={orderForm.description}
                          onChange={handleOrderChange}
                          rows={4}
                        />
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Status</label>
                          <select
                            name="status"
                            value={orderForm.status}
                            onChange={handleOrderChange}
                          >
                            <option value="neu">Neu</option>
                            <option value="geplant">Geplant</option>
                            <option value="in_arbeit">In Arbeit</option>
                            <option value="pausiert">Pausiert</option>
                            <option value="fertig">Fertig</option>
                            <option value="abgerechnet">Abgerechnet</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Straße</label>
                          <input
                            type="text"
                            name="address_street"
                            value={orderForm.address_street}
                            onChange={handleOrderChange}
                          />
                        </div>
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>PLZ</label>
                          <input
                            type="text"
                            name="address_zip"
                            value={orderForm.address_zip}
                            onChange={handleOrderChange}
                          />
                        </div>

                        <div className="form-group">
                          <label>Ort</label>
                          <input
                            type="text"
                            name="address_city"
                            value={orderForm.address_city}
                            onChange={handleOrderChange}
                          />
                        </div>
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Startdatum</label>
                          <input
                            type="date"
                            name="start_date"
                            value={orderForm.start_date}
                            onChange={handleOrderChange}
                          />
                        </div>

                        <div className="form-group">
                          <label>Enddatum</label>
                          <input
                            type="date"
                            name="end_date"
                            value={orderForm.end_date}
                            onChange={handleOrderChange}
                          />
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={savingOrder}
                        >
                          {savingOrder ? "Speichert..." : "Änderungen speichern"}
                        </button>
                      </div>

                      {orderMessage && <p className="info-text">{orderMessage}</p>}

                          <div className="settings-section" style={{ marginTop: "30px" }}>
  <h3>Auftragsverlauf</h3>

  {orderProgress.length === 0 ? (
    <p className="info-text">Noch keine Fortschrittseinträge vorhanden.</p>
  ) : (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Status</th>
            <th>Notiz</th>
          </tr>
        </thead>
        <tbody>
          {orderProgress.map((entry) => (
            <tr key={entry.id}>
              <td>
                {new Date(entry.created_at).toLocaleString("de-DE")}
              </td>
              <td>{entry.status || "-"}</td>
              <td>{entry.note || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
                      
                    </form>
                  </div>
                </section>
              )}

              {currentPage === "create-employee" && isAdmin && (
                <section className="single-page-section">
                  <div className="card form-page-card">
                    <div className="page-topbar">
                      <div>
                        <h2>Mitarbeiter anlegen</h2>
                        <p>Neuen Mitarbeiter im aktuellen Tenant erfassen.</p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={openDashboard}
                      >
                        Zurück zum Dashboard
                      </button>
                    </div>

                    <form onSubmit={handleCreateEmployee} className="form-stack">
                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Vorname</label>
                          <input
                            type="text"
                            name="first_name"
                            value={employeeForm.first_name}
                            onChange={handleEmployeeChange}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Nachname</label>
                          <input
                            type="text"
                            name="last_name"
                            value={employeeForm.last_name}
                            onChange={handleEmployeeChange}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>E-Mail</label>
                          <input
                            type="email"
                            name="email"
                            value={employeeForm.email}
                            onChange={handleEmployeeChange}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Telefon</label>
                          <input
                            type="text"
                            name="phone"
                            value={employeeForm.phone}
                            onChange={handleEmployeeChange}
                          />
                        </div>
                        <div className="form-group">
                          <label>Stundensatz intern ({currencySymbol} / Stunde)</label>
                          <input
                            type="number"
                            name="hourly_rate"
                            value={employeeForm.hourly_rate}
                            onChange={handleEmployeeChange}
                            step="0.01"
                            min="0"
                            placeholder="z. B. 28.50"
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Passwort</label>
                        <input
                          type="password"
                          name="password"
                          value={employeeForm.password}
                          onChange={handleEmployeeChange}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Rolle</label>
                        <select
                          name="role_id"
                          value={employeeForm.role_id}
                          onChange={handleEmployeeChange}
                          required
                        >
                          <option value={String(PROJECT_MANAGER_ROLE_ID)}>Projektleiter</option>
                          <option value={String(EMPLOYEE_ROLE_ID)}>Mitarbeiter</option>
                        </select>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={savingEmployee}
                        >
                          {savingEmployee ? "Speichert..." : "Mitarbeiter speichern"}
                        </button>
                      </div>

                      {employeeMessage && <p className="info-text">{employeeMessage}</p>}
                    </form>
                  </div>
                </section>
              )}

              {currentPage === "edit-employee" && isAdmin && (
                <section className="single-page-section">
                  <div className="card form-page-card">
                    <div className="page-topbar">
                      <div>
                        <h2>Mitarbeiter bearbeiten</h2>
                        <p>Bestehende Mitarbeiterdaten aktualisieren.</p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={openEmployeesListPage}
                      >
                        Zurück zur Mitarbeiterliste
                      </button>
                    </div>

                    <form onSubmit={handleUpdateEmployee} className="form-stack">
                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Vorname</label>
                          <input
                            type="text"
                            name="first_name"
                            value={employeeForm.first_name}
                            onChange={handleEmployeeChange}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Nachname</label>
                          <input
                            type="text"
                            name="last_name"
                            value={employeeForm.last_name}
                            onChange={handleEmployeeChange}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>E-Mail</label>
                          <input
                            type="email"
                            name="email"
                            value={employeeForm.email}
                            onChange={handleEmployeeChange}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Telefon</label>
                          <input
                            type="text"
                            name="phone"
                            value={employeeForm.phone}
                            onChange={handleEmployeeChange}
                          />
                        </div>

                        <div className="form-group">
                          <label>Stundensatz intern ({currencySymbol} / Stunde)</label>
                          <input
                            type="number"
                            name="hourly_rate"
                            value={employeeForm.hourly_rate}
                            onChange={handleEmployeeChange}
                            step="0.01"
                            min="0"
                            placeholder="z. B. 28.50"
                          />
                        </div>

                        <div className="form-group">
                          <label>Rolle</label>
                          <select
                            name="role_id"
                            value={employeeForm.role_id}
                            onChange={handleEmployeeChange}
                            required
                          >
                            <option value={String(PROJECT_MANAGER_ROLE_ID)}>Projektleiter</option>
                            <option value={String(EMPLOYEE_ROLE_ID)}>Mitarbeiter</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={savingEmployee}
                        >
                          {savingEmployee ? "Speichert..." : "Änderungen speichern"}
                        </button>
                      </div>

                      {employeeMessage && <p className="info-text">{employeeMessage}</p>}
                    </form>
                  </div>
                </section>
              )}

              {currentPage === "pricing-rules" && (
                userProfile?.role_id === 1 ||
                userProfile?.role_id === 2
              ) && (
                  <section className="single-page-section">
                    <div className="card form-page-card">
                      <div className="page-topbar">
                        <div>
                          <h2>Preisregeln</h2>
                          <p>Hier werden die Standardpreise für die automatische Angebotserstellung gepflegt.</p>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={openDashboard}
                        >
                          Zurück zum Dashboard
                        </button>
                      </div>

                      {loadingPricingRules && <p className="info-text">Preisregeln werden geladen...</p>}
                      {pricingRulesMessage && <p className="info-text">{pricingRulesMessage}</p>}

                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Leistung</th>
                              <th>Einheit</th>
                              <th>Preis</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pricingRules.map((rule) => (
                              <tr key={rule.id}>
                                <td>{rule.label}</td>
                                <td>{rule.unit}</td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={rule.unit_price}
                                    onChange={(e) => updatePricingRuleValue(rule.id, e.target.value)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="form-actions" style={{ marginTop: "20px" }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={savePricingRules}
                          disabled={savingPricingRules}
                        >
                          {savingPricingRules ? "Speichert..." : "Preisregeln speichern"}
                        </button>
                      </div>
                    </div>
                  </section>
                )}

{currentPage === "messages" && (
  <section className="single-page-section">
    <div className="card form-page-card">
      <div className="page-topbar">
        <div>
          <h2>Nachrichten</h2>
          <p>Interne Kommunikation im Team.</p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={openDashboard}
        >
          Zurück zum Dashboard
        </button>
      </div>

        <div className="form-group" style={{ marginTop: "20px" }}>
  <label>Empfänger</label>
  <select
    className="search-input"
    value={messageRecipientId}
    onChange={(e) => setMessageRecipientId(e.target.value)}
  >
    <option value="">Alle</option>

    {messageRecipients.map((user) => {
  const roleLabel =
    user.role_id === 2
      ? "🔴 Admin"
      : user.role_id === 3
      ? "🔵 Projektleiter"
      : "🟢 Mitarbeiter";

  return (
    <option key={user.id} value={String(user.id)}>
      {roleLabel} · {user.first_name || ""} {user.last_name || ""}
    </option>
  );
})}
  </select>
</div>

      <div className="form-group" style={{ marginTop: "20px" }}>
        <textarea
          className="search-input"
          rows={3}
          placeholder="Nachricht schreiben..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
      </div>

        <div className="form-group" style={{ marginTop: "12px" }}>
  <label>Bild anhängen</label>
  <input
    type="file"
    accept="image/png,image/jpeg,image/webp"
    onChange={(e) => setMessageImage(e.target.files?.[0] || null)}
  />

  {messageImage && (
    <p className="info-text" style={{ marginTop: "8px" }}>
      Ausgewählt: {messageImage.name}
    </p>
  )}
</div>

      <div className="form-actions" style={{ marginTop: "15px" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSendMessage}
        >
          Nachricht senden
        </button>
      </div>

      <div style={{ marginTop: "30px", display: "grid", gap: "12px" }}>
        {messages.length === 0 ? (
          <p>Noch keine Nachrichten vorhanden.</p>
        ) : (
          messages.map((msg) => {
  const isOwnMessage = Number(msg.sender_id) === userProfile?.id;

  const sender =
    messageRecipients.find((u) => Number(u.id) === Number(msg.sender_id)) ||
    employees.find((u) => Number(u.id) === Number(msg.sender_id));

  const roleColor =
    sender?.role_id === 2
      ? "#fee2e2"
      : sender?.role_id === 3
      ? "#dbeafe"
      : "#dcfce7";

  return (
    <div
      key={msg.id}
      style={{
        display: "flex",
        justifyContent: isOwnMessage ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: "14px",
          borderRadius: "18px",
          background: isOwnMessage ? "#6d28d9" : "#ffffff",
          color: isOwnMessage ? "#ffffff" : "#111827",
          border: `2px solid ${isOwnMessage ? "#6d28d9" : roleColor}`,
          maxWidth: "75%",
          width: "fit-content",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        {(msg.sender_id === userProfile?.id || isAdmin) && (
          <button
            type="button"
            onClick={() => handleDeleteMessage(Number(msg.id))}
            style={{
              position: "absolute",
              top: "8px",
              right: "10px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "16px",
            }}
            title="Nachricht löschen"
          >
            🗑️
          </button>
        )}

        <div
          style={{
            fontSize: "12px",
            marginBottom: "8px",
            paddingRight: "28px",
            color: isOwnMessage ? "#ede9fe" : "#64748b",
          }}
        >
          <strong>
            {userNameMap.get(Number(msg.sender_id)) ||
              `Benutzer #${msg.sender_id}`}
          </strong>
          {" · "}
          {formatDateTime(msg.created_at)}
        </div>

        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {msg.message}
        </div>

        {msg.image_url && (
          <img
            src={msg.image_url}
            alt="Nachrichtenbild"
            style={{
              marginTop: "12px",
              maxWidth: "320px",
              width: "100%",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          />
        )}
      </div>
    </div>
  );
})
        )}
      </div>
    </div>
  </section>
)}
{currentPage === "invoices-list" && (
  <InvoicesPage
    onBack={openDashboard}
  />
)}
            </>
          )}

        </div>
      </div>
    );
  }