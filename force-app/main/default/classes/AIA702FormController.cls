public with sharing class AIA702FormController {
    
    public String billingId { get; set; }
    public AIA702DataWrapper formData { get; set; }
    
    public AIA702FormController() {
        billingId = ApexPages.currentPage().getParameters().get('id');
        if (String.isNotBlank(billingId)) {
            loadFormData();
        }
    }
    
    public void loadFormData() {
        try {
            formData = getAIA702Data(billingId);
        } catch (Exception e) {
            ApexPages.addMessage(new ApexPages.Message(ApexPages.Severity.ERROR, 'Error loading data: ' + e.getMessage()));
        }
    }
    
    public PageReference generatePDF() {
        PageReference pdfPage = Page.AIA702FormPage;
        pdfPage.getParameters().put('id', billingId);
        pdfPage.getParameters().put('renderAs', 'pdf');
        pdfPage.setRedirect(true);
        return pdfPage;
    }
    
    public static AIA702DataWrapper getAIA702Data(String billingId) {
        AIA702DataWrapper wrapper = new AIA702DataWrapper();
        
        // Query Billing record with all required fields
        Billing__c bill = [
            SELECT Id, Name, Job__r.Retainage__c, Retainage_on_Bill__c, 
                   Job__r.Total_Contract_Price__c, Job__r.Total_Change_Order_Value__c,Total_Billed_Amount__c,
                   Contract_Sum_to_Date__c, 
                   Total_Amount_Earned_Less_Retainage__c, 
                   Balance_to_Finish_Retainage__c, Account__r.Name, Application_Number__c, 
                   Billing_Reference_Number__c, Is_Retainage_Billing__c, Previous_Bill__c, 
                   Previous_Billed_Amount__c, Sent_Date__c, Start_Date__c, End_Date__c, 
                   Status__c, Job__r.Name, Job__r.Job_Name__c, 
                   Job__r.Account__r.Name, Payment_Due_Date__c,
                   Job__r.Account__r.BillingStreet, Job__r.Account__r.BillingCity,
                   Job__r.Account__r.BillingState, Job__r.Account__r.BillingPostalCode,
                   CreatedDate
            FROM Billing__c
            WHERE Id = :billingId
            WITH USER_MODE
            LIMIT 1
        ];
        
        // Populate header information
        wrapper.contractorName = bill.Account__r?.Name;
        wrapper.contractorAddress = getFormattedAddress(
            bill.Job__r?.Account__r?.BillingStreet,
            bill.Job__r?.Account__r?.BillingCity,
            bill.Job__r?.Account__r?.BillingState,
            bill.Job__r?.Account__r?.BillingPostalCode
        );
        
        wrapper.projectName = bill.Job__r?.Job_Name__c;
        wrapper.applicationNumber = bill.Application_Number__c;
        wrapper.distributionTo = 'OWNER'; // Default values as per form
        wrapper.periodTo = bill.End_Date__c?.format();
        wrapper.projectNumber = bill.Job__r?.Name;
        wrapper.contractDate = bill.CreatedDate?.format();
        
        // Application for Payment section
        wrapper.originalContractSum = bill.Job__r?.Total_Contract_Price__c != null ? 
            bill.Job__r.Total_Contract_Price__c : 0.00;
        wrapper.netChangeByChangeOrders = bill.Job__r?.Total_Change_Order_Value__c != null ? 
            bill.Job__r.Total_Change_Order_Value__c : 0.00;
        wrapper.contractSumToDate = wrapper.originalContractSum + wrapper.netChangeByChangeOrders;
        wrapper.totalCompletedAndStoredToDate = bill.Total_Billed_Amount__c != null ? 
            bill.Total_Billed_Amount__c : 0.00;
        
        // Retainage calculations
        Decimal retainagePercent = bill.Job__r?.Retainage__c != null ? 
            bill.Job__r.Retainage__c : 0.00;
        wrapper.retainagePercent = retainagePercent;
        wrapper.totalOfCompletedWork = (wrapper.totalCompletedAndStoredToDate * retainagePercent) / 100;
        wrapper.totalOfStoredMaterial = 0.00; // Default, can be calculated if needed
        wrapper.totalRetainage = wrapper.totalOfCompletedWork + wrapper.totalOfStoredMaterial;
        wrapper.totalEarnedLessRetainage = wrapper.totalCompletedAndStoredToDate - wrapper.totalRetainage;
        wrapper.lessRetainageFromPriorCertificate = bill.Previous_Billed_Amount__c != null ? 
            bill.Previous_Billed_Amount__c : 0.00;
        wrapper.currentPaymentDue = wrapper.totalEarnedLessRetainage - wrapper.lessRetainageFromPriorCertificate;
        wrapper.balanceToFinishIncludingRetainage = wrapper.contractSumToDate - wrapper.totalCompletedAndStoredToDate;
        
        // Change Order Summary
        wrapper.totalChangesApprovedInPreviousMonths = 0.00; // Default
        wrapper.totalApprovedThisMonth = 0.00; // Default
        wrapper.totals = wrapper.totalChangesApprovedInPreviousMonths + wrapper.totalApprovedThisMonth;
        wrapper.netChangesByChangeOrder = wrapper.netChangeByChangeOrders;
        
        // Query Billing Line Items for Schedule of Values
        List<Billing_Line_Item__c> billLineItems = [
            SELECT Id, Billing__c, Scope_Entry__c, Scope_Entry__r.Name, 
                   Scope_Entry_Type__c, Scope_Contract_Value__c,
                   Previous_Billed_Value__c, Previous_Billed_Percent__c, This_Billing_Percent__c,
                   Current_Process_Complete__c, Total_Complete_Amount__c, This_Billing_Value__c,
                   Due_This_Billing__c, Retainage_Percent_on_Bill_Line_Item__c,
                   Retainage_Amount_on_Bill_Line_Item__c
            FROM Billing_Line_Item__c
            WHERE Billing__c = :billingId
            ORDER BY Scope_Entry__r.Name
        ];
        
        wrapper.scheduleOfValues = new List<ScheduleOfValueItem>();
        Integer itemNumber = 1;
        
        for (Billing_Line_Item__c item : billLineItems) {
            ScheduleOfValueItem sovItem = new ScheduleOfValueItem();
            sovItem.itemNumber = itemNumber++;
            sovItem.description = item.Scope_Entry__r?.Name;
            sovItem.scheduledValue = item.Scope_Contract_Value__c != null ? 
                item.Scope_Contract_Value__c : 0.00;
            sovItem.fromPreviousApplication = item.Previous_Billed_Value__c != null ? 
                item.Previous_Billed_Value__c : 0.00;
            sovItem.thisPeriodInPlace = item.This_Billing_Value__c != null ? 
                item.This_Billing_Value__c : 0.00;
            sovItem.materialsPresently = 0.00; // Default
            sovItem.totalCompleted = sovItem.fromPreviousApplication + sovItem.thisPeriodInPlace;
            sovItem.percentGC = sovItem.scheduledValue > 0 ? 
                (sovItem.totalCompleted / sovItem.scheduledValue) * 100 : 0.00;
            sovItem.balanceToFinish = sovItem.scheduledValue - sovItem.totalCompleted;
            sovItem.retainage = item.Retainage_Amount_on_Bill_Line_Item__c != null ? 
                item.Retainage_Amount_on_Bill_Line_Item__c : 0.00;
            sovItem.retainageFromPrevious = 0.00; // Default
            
            wrapper.scheduleOfValues.add(sovItem);
        }
        
        // Calculate totals for Schedule of Values
        wrapper.totalScheduledValue = 0.00;
        wrapper.totalFromPreviousApplication = 0.00;
        wrapper.totalThisPeriodInPlace = 0.00;
        wrapper.totalMaterialsPresently = 0.00;
        wrapper.totalCompleted = 0.00;
        wrapper.totalBalanceToFinish = 0.00;
        wrapper.totalRetainageAmount = 0.00;
        wrapper.totalRetainageFromPrevious = 0.00;
        
        for (ScheduleOfValueItem item : wrapper.scheduleOfValues) {
            wrapper.totalScheduledValue += item.scheduledValue;
            wrapper.totalFromPreviousApplication += item.fromPreviousApplication;
            wrapper.totalThisPeriodInPlace += item.thisPeriodInPlace;
            wrapper.totalMaterialsPresently += item.materialsPresently;
            wrapper.totalCompleted += item.totalCompleted;
            wrapper.totalBalanceToFinish += item.balanceToFinish;
            wrapper.totalRetainageAmount += item.retainage;
            wrapper.totalRetainageFromPrevious += item.retainageFromPrevious;
        }
        
        return wrapper;
    }
    
    private static String getFormattedAddress(String street, String city, String state, String postalCode) {
        List<String> addressParts = new List<String>();
        if (String.isNotBlank(street)) addressParts.add(street);
        if (String.isNotBlank(city)) addressParts.add(city);
        if (String.isNotBlank(state)) addressParts.add(state);
        if (String.isNotBlank(postalCode)) addressParts.add(postalCode);
        return String.join(addressParts, ', ');
    }
    
    // Wrapper classes
    public class AIA702DataWrapper {
        public String contractorName { get; set; }
        public String contractorAddress { get; set; }
        public String projectName { get; set; }
        public String applicationNumber { get; set; }
        public String distributionTo { get; set; }
        public String periodTo { get; set; }
        public String projectNumber { get; set; }
        public String contractDate { get; set; }
        public String generalInfo { get; set; }
        
        // Application for Payment
        public Decimal originalContractSum { get; set; }
        public Decimal netChangeByChangeOrders { get; set; }
        public Decimal contractSumToDate { get; set; }
        public Decimal totalCompletedAndStoredToDate { get; set; }
        public Decimal retainagePercent { get; set; }
        public Decimal totalOfCompletedWork { get; set; }
        public Decimal totalOfStoredMaterial { get; set; }
        public Decimal totalRetainage { get; set; }
        public Decimal totalEarnedLessRetainage { get; set; }
        public Decimal lessRetainageFromPriorCertificate { get; set; }
        public Decimal currentPaymentDue { get; set; }
        public Decimal balanceToFinishIncludingRetainage { get; set; }
        
        // Change Order Summary
        public Decimal totalChangesApprovedInPreviousMonths { get; set; }
        public Decimal totalApprovedThisMonth { get; set; }
        public Decimal totals { get; set; }
        public Decimal netChangesByChangeOrder { get; set; }
        
        // Schedule of Values
        public List<ScheduleOfValueItem> scheduleOfValues { get; set; }
        public Decimal totalScheduledValue { get; set; }
        public Decimal totalFromPreviousApplication { get; set; }
        public Decimal totalThisPeriodInPlace { get; set; }
        public Decimal totalMaterialsPresently { get; set; }
        public Decimal totalCompleted { get; set; }
        public Decimal totalBalanceToFinish { get; set; }
        public Decimal totalRetainageAmount { get; set; }
        public Decimal totalRetainageFromPrevious { get; set; }
        
        public AIA702DataWrapper() {
            scheduleOfValues = new List<ScheduleOfValueItem>();
        }
    }
    
    public class ScheduleOfValueItem {
        public Integer itemNumber { get; set; }
        public String description { get; set; }
        public Decimal scheduledValue { get; set; }
        public Decimal fromPreviousApplication { get; set; }
        public Decimal thisPeriodInPlace { get; set; }
        public Decimal materialsPresently { get; set; }
        public Decimal totalCompleted { get; set; }
        public Decimal percentGC { get; set; }
        public Decimal balanceToFinish { get; set; }
        public Decimal retainage { get; set; }
        public Decimal retainageFromPrevious { get; set; }
    }
}