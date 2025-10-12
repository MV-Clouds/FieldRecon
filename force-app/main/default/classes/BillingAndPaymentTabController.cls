public with sharing class BillingAndPaymentTabController {
    
    @AuraEnabled
    public static List<Job__c> getJobData(String jobId){
        try {
            return [SELECT Id, Name, Job_Name__c, Retainage__c, Status__c FROM Job__c WHERE Id = :jobId WITH USER_MODE];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Billing__c> getBillingsData(String jobId){
        try {
            return [SELECT Id, Name, Status__c, Job__r.Job_Name__c, Job__r.Retainage__c, Start_Date__c, End_Date__c, Sent_Date__c, Amount__c, Billing_Reference_Number__c FROM Billing__c WHERE Job__c = :jobId WITH USER_MODE ORDER BY Name DESC];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Payment__c> getPaymentsData(String jobId){
        try {
            return [SELECT Id, Name, Payment_Name__c, Job__r.Job_Name__c, Payment_Reference__c, Payment_Received_Date__c, Payable_Amount_Received__c FROM Payment__c WHERE Job__c = :jobId WITH USER_MODE ORDER BY Name DESC];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}