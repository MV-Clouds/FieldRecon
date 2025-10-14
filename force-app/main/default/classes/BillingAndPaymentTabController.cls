/**
* Class Name: BillingAndPaymentTabController
* Test Class: BillingAndPaymentTabControllerTest
* @description: Controller for Billing and Payment Tab
* Created Date: 12 Oct 2025
* Created By: Harsh Gandhi
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/
public with sharing class BillingAndPaymentTabController {

    /*
    *********************************************************
    @description     : Fetch Job Data
    @param           : {String} jobId - Job Record Id
    @return          : List<Job__c> - List of job details
    ********************************************************
    */
    @AuraEnabled
    public static List<Job__c> getJobData(String jobId){
        try {
            return [
                SELECT Id, Name, Job_Name__c, Retainage__c, Status__c, Account__c 
                FROM Job__c 
                WHERE Id = :jobId 
                WITH USER_MODE
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'getJobData', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Fetch Billing Data
    @param           : {String} jobId - Job Record Id
    @return          : BillingResponse - Custom response class containing billing details and status
    ********************************************************
    */
    @AuraEnabled
    public static BillingResponse getBillingsData(String jobId){
        try {
            BillingResponse response = new BillingResponse();

            // Step 1: Check for approved scope entries
            List<Scope_Entry__c> scopeEntries = [
                SELECT Id
                FROM Scope_Entry__c
                WHERE Job__c = :jobId
                AND Scope_Entry_Status__c = 'Approved'
                WITH USER_MODE
                LIMIT 1
            ];

            if (scopeEntries.isEmpty()) {
                response.hasApprovedScopeEntries = false;
                response.message = 'No approved scope entries found for this job.';
                response.billings = new List<Billing__c>();
                return response;
            }

            // Step 2: Fetch billings if approved scope entries exist
            List<Billing__c> billings = [
                SELECT Id, Name, Status__c, Job__r.Job_Name__c, Job__r.Retainage__c,
                       Start_Date__c, End_Date__c, Sent_Date__c, Amount__c, Billing_Reference_Number__c
                FROM Billing__c
                WHERE Job__c = :jobId
                WITH USER_MODE
                ORDER BY Name DESC
            ];

            response.hasApprovedScopeEntries = true;
            response.billings = billings;
            response.message = billings.isEmpty() ? 'No billing records found for this job.' : null;

            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'getBillingsData', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Fetch Payment Data
    @param           : {String} jobId - Job Record Id
    @return          : PaymentResponse - Custom response class containing payment details and status
    ********************************************************
    */
    @AuraEnabled
    public static PaymentResponse getPaymentsData(String jobId){
        try {
            PaymentResponse response = new PaymentResponse();
            
            // Step 1: Check for approved billing records
            List<Billing__c> approvedBillings = [
                SELECT Id, Name
                FROM Billing__c
                WHERE Job__c = :jobId
                AND Status__c = 'Approved'
                WITH USER_MODE
            ];

            if (approvedBillings.isEmpty()) {
                response.hasApprovedBillings = false;
                response.message = 'No approved billing records found for this job. Payment creation is not allowed.';
                response.payments = new List<Payment__c>();
                response.approvedBillings = new List<Billing__c>();
                return response;
            }

            // Step 2: Fetch payments if approved billings exist
            List<Payment__c> payments = [
                SELECT Id, Name, Payment_Name__c, Job__r.Job_Name__c, Payment_Reference__c,
                       Payment_Received_Date__c, Payable_Amount_Received__c
                FROM Payment__c
                WHERE Job__c = :jobId
                WITH USER_MODE
                ORDER BY Name DESC
            ];

            response.hasApprovedBillings = true;
            response.payments = payments;
            response.approvedBillings = approvedBillings;
            response.message = payments.isEmpty() ? 'No payment records found for this job.' : null;

            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'getPaymentsData', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Create Billing Record
    @param           : {String} jobId - Job Record Id
    @param           : {Date} startDate - Start Date
    @param           : {Date} endDate - End Date
    @param           : {Boolean} isRetainage - Is Retainage Billing
    @return          : String - SUCCESS
    ********************************************************
    */
    @AuraEnabled
    public static String createBilling(String jobId, Date startDate, Date endDate, Boolean isRetainage){
        try {
            Job__c job = [SELECT Id, Account__c, Retainage__c FROM Job__c WHERE Id = :jobId LIMIT 1];

            Billing__c b = new Billing__c();
            b.Job__c = jobId;
            b.Account__c = job.Account__c;
            b.Status__c = 'Draft';
            b.Job_Retainage__c = job.Retainage__c;
            b.Is_Retainage_Billing__c = isRetainage;
            b.Start_Date__c = startDate;
            b.End_Date__c = endDate;
            insert b;

            List<Scope_Entry__c> scopeEntries = [
                SELECT Id, Name, Contract_Value__c, Type__c, Scope_Entry_Status__c, Job__c, Completed_Percentage__c, Current_Complete_Value__c 
                FROM Scope_Entry__c 
                WHERE Job__c = :jobId AND Scope_Entry_Status__c = 'Approved'
                WITH USER_MODE
            ];

            List<Billing_Line_Item__c> billLinesToInsert = new List<Billing_Line_Item__c>();
            for (Scope_Entry__c se : scopeEntries) {
                Billing_Line_Item__c bli = new Billing_Line_Item__c();
                bli.Billing__c = b.Id;
                bli.Scope_Entry__c = se.Id;
                bli.Percent_Scope_Complete__c = se.Current_Complete_Value__c;
                billLinesToInsert.add(bli);
            }
            
            if(billLinesToInsert.size() > 0) {
                insert billLinesToInsert;
            }
            
            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'createBilling', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Create Payment Record
    @param           : {String} jobId - Job Record Id
    @param           : {String} billId - Billing Record Id
    @param           : {String} paymentReference - Payment Reference
    @param           : {Date} paymentDate - Payment Received Date
    @param           : {String} accountId - Account Id
    @return          : String - SUCCESS
    ********************************************************
    */
    @AuraEnabled
    public static string createPayment(String jobId, String billId, String paymentReference, Date paymentDate, String accountId){
        try {
            Payment__c p = new Payment__c();
            p.Job__c = jobId;
            p.Account__c = accountId;
            p.Billing__c = billId;
            p.Payment_Reference__c = paymentReference;
            p.Payment_Received_Date__c = paymentDate;
            insert p;

            List<Billing_Line_Item__c> bli = [
                SELECT Id, Scope_Entry__c 
                FROM Billing_Line_Item__c 
                WHERE Billing__c = :billId
                WITH USER_MODE
            ];

            List<Payment_Line_Item__c> pliToInsert = new List<Payment_Line_Item__c>();
            for (Billing_Line_Item__c bliItem : bli) {
                Payment_Line_Item__c pli = new Payment_Line_Item__c();
                pli.Payment__c = p.Id;
                pli.Billing_Line_Item__c = bliItem.Id;
                pli.Scope_Entry__c = bliItem.Scope_Entry__c;
                pliToInsert.add(pli);
            }

            if(pliToInsert.size() > 0) {
                insert pliToInsert;
            }

            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'createPayment', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Approve Billing Record
    @param           : {String} billingId - Billing Record Id
    @return          : String - SUCCESS
    ********************************************************
    */
    @AuraEnabled
    public static String approveBilling(Id billingId){
        try {
            Billing__c billing = [SELECT Id, Status__c FROM Billing__c WHERE Id = :billingId LIMIT 1];

            if (billing.Status__c != 'Approved') {
                billing.Status__c = 'Approved';
                update billing;
            }
            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'approveBilling', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Delete Record
    @param           : {Id} recordId - Record Id to delete
    @param           : {String} sObjectApiName - API Name of the sObject
    @return          : String - SUCCESS
    ********************************************************
    */
    @AuraEnabled
    public static String deleteRecord(Id recordId, String sObjectApiName){
        try {
            // Allow only specific objects
            Set<String> allowed = new Set<String>{ 'Billing__c', 'Payment__c' };
            if (!allowed.contains(sObjectApiName)) {
                throw new AuraHandledException('Unsupported object type for deletion.');
            }
            // Construct a stub sObject with Id and delete
            Type t = Type.forName('Schema.' + sObjectApiName);
            if (t == null) {
                throw new AuraHandledException('Invalid sObject API Name.');
            }
            SObject sobj = (SObject) t.newInstance();
            sobj.put('Id', recordId);
            Database.delete(sobj, false);
            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'deleteRecord', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class BillingResponse {
        @AuraEnabled public Boolean hasApprovedScopeEntries;
        @AuraEnabled public String message;
        @AuraEnabled public List<Billing__c> billings;
    }

    public class PaymentResponse {
        @AuraEnabled public Boolean hasApprovedBillings;
        @AuraEnabled public String message;
        @AuraEnabled public List<Payment__c> payments;
        @AuraEnabled public List<Billing__c> approvedBillings;
    }
}