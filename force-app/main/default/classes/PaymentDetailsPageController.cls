public with sharing class PaymentDetailsPageController {

    @AuraEnabled
    public static PaymentDataWrapper getPaymentData(String paymentId) {
        try {
            PaymentDataWrapper wrapper = new PaymentDataWrapper();

            // Query Payment record with related billing and job information
            wfrecon__Payment__c payment = [
                SELECT Id, Name, wfrecon__Account__c, wfrecon__Account__r.Name, wfrecon__Account__r.BillingStreet, 
                       wfrecon__Account__r.BillingCity, wfrecon__Account__r.BillingState, wfrecon__Account__r.BillingPostalCode,
                       wfrecon__Billing__c, wfrecon__Billing__r.Name, wfrecon__Billing__r.wfrecon__Job__c, 
                       wfrecon__Billing__r.wfrecon__Job__r.Name, wfrecon__Billing__r.wfrecon__Job__r.wfrecon__Job_Name__c,
                       wfrecon__Payment_Received_Date__c, wfrecon__Payment_Reference__c
                FROM wfrecon__Payment__c
                WHERE Id = :paymentId
                WITH USER_MODE
                LIMIT 1
            ];

            // Populate Payment details in wrapper with null checks and default values
            wrapper.paymentDetails = new PaymentWrapper();
            wrapper.paymentDetails.Id = payment.Id;
            wrapper.paymentDetails.Name = String.isNotBlank(payment.Name) ? payment.Name : '-';
            wrapper.paymentDetails.AccountName = (payment.wfrecon__Account__r != null && String.isNotBlank(payment.wfrecon__Account__r.Name)) ? payment.wfrecon__Account__r.Name : '-';
            wrapper.paymentDetails.Address = buildAddress(payment.wfrecon__Account__r);
            wrapper.paymentDetails.BillingId = payment.wfrecon__Billing__c;
            wrapper.paymentDetails.BillingNumber = (payment.wfrecon__Billing__r != null && String.isNotBlank(payment.wfrecon__Billing__r.Name)) ? payment.wfrecon__Billing__r.Name : '-';
            wrapper.paymentDetails.JobId = payment.wfrecon__Billing__r?.wfrecon__Job__c;
            wrapper.paymentDetails.JobName = (payment.wfrecon__Billing__r?.wfrecon__Job__r != null && String.isNotBlank(payment.wfrecon__Billing__r.wfrecon__Job__r.wfrecon__Job_Name__c)) ? payment.wfrecon__Billing__r.wfrecon__Job__r.wfrecon__Job_Name__c : '-';
            wrapper.paymentDetails.JobNumber = (payment.wfrecon__Billing__r?.wfrecon__Job__r != null && String.isNotBlank(payment.wfrecon__Billing__r.wfrecon__Job__r.Name)) ? payment.wfrecon__Billing__r.wfrecon__Job__r.Name : '-';
            wrapper.paymentDetails.PaymentReceivedDate = payment.wfrecon__Payment_Received_Date__c;
            wrapper.paymentDetails.PaymentReference = String.isNotBlank(payment.wfrecon__Payment_Reference__c) ? payment.wfrecon__Payment_Reference__c : '';

            // Query Payment Line Items with related Billing Line Item information
            List<wfrecon__Payment_Line_Item__c> paymentLineItems = [
                SELECT Id, wfrecon__Billing_Line_Item__c, wfrecon__Amount_Received__c,
                       wfrecon__Billing_Line_Item__r.wfrecon__Scope_Entry__r.Name,
                       wfrecon__Billing_Line_Item__r.wfrecon__Scope_Contract_Amount__c,
                       wfrecon__Billing_Line_Item__r.wfrecon__This_Billing_Value__c,
                       wfrecon__Billing_Line_Item__r.wfrecon__Scope_Entry_Type__c,
                       wfrecon__Billing_Line_Item__r.Bill_Item_Type__c,
                       wfrecon__Billing_Line_Item__r.wfrecon__Total_Retainage_Amount__c
                FROM wfrecon__Payment_Line_Item__c
                WHERE wfrecon__Payment__c = :paymentId
                WITH USER_MODE
                ORDER BY wfrecon__Billing_Line_Item__r.wfrecon__Scope_Entry__r.Name
            ];

            // Calculate total paid amount
            Decimal totalPaidAmount = 0;
            for(wfrecon__Payment_Line_Item__c pli : paymentLineItems) {
                if (pli.wfrecon__Amount_Received__c != null) {
                    totalPaidAmount += pli.wfrecon__Amount_Received__c;
                }
            }
            wrapper.paymentDetails.TotalPaidAmount = totalPaidAmount;

            wrapper.paymentLineItems = paymentLineItems;

            return wrapper;

        } catch (Exception e) {
            System.debug('Error fetching payment data: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String updatePaymentDetails(String paymentId, Map<String, Object> fieldValues) {
        try {
            wfrecon__Payment__c payment = [SELECT Id FROM wfrecon__Payment__c WHERE Id = :paymentId WITH USER_MODE LIMIT 1];
            
            // Update fields based on the map values
            if (fieldValues.containsKey('PaymentReference')) {
                payment.wfrecon__Payment_Reference__c = (String) fieldValues.get('PaymentReference');
            }
            if (fieldValues.containsKey('PaymentReceivedDate')) {
                payment.wfrecon__Payment_Received_Date__c = Date.valueOf((String) fieldValues.get('PaymentReceivedDate'));
            }
            
            update payment;
            
            return 'SUCCESS';
        } catch (Exception e) {
            System.debug('Error updating payment details: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String savePaymentLineItems(String paymentId, List<Map<String, Object>> lineItemUpdates) {
        try {
            // Collect record Ids from updates
            Set<Id> recordIds = new Set<Id>();
            Map<Id, Map<String, Object>> updateMap = new Map<Id, Map<String, Object>>();
            
            for (Map<String, Object> line : lineItemUpdates) {
                if (line.containsKey('Id') && line.get('Id') != null) {
                    Id recordId = (Id) line.get('Id');
                    recordIds.add(recordId);
                    updateMap.put(recordId, line);
                }
            }

            if (recordIds.isEmpty()) {
                return 'No records to update';
            }

            // Query existing Payment Line Items
            List<wfrecon__Payment_Line_Item__c> lineItems = [
                SELECT Id, wfrecon__Amount_Received__c
                FROM wfrecon__Payment_Line_Item__c
                WHERE Id IN :recordIds
                WITH USER_MODE
            ];

            List<wfrecon__Payment_Line_Item__c> itemsToUpdate = new List<wfrecon__Payment_Line_Item__c>();

            for (wfrecon__Payment_Line_Item__c item : lineItems) {
                Map<String, Object> updates = updateMap.get(item.Id);
                if (updates != null) {
                    Boolean hasChanges = false;
                    
                    // Update Amount Received
                    if (updates.containsKey('AmountReceived')) {
                        Object newValue = updates.get('AmountReceived');
                        Decimal newAmountReceived = null;
                        
                        if (newValue != null && String.valueOf(newValue) != '') {
                            newAmountReceived = Decimal.valueOf(String.valueOf(newValue));
                        }
                        
                        if (item.wfrecon__Amount_Received__c != newAmountReceived) {
                            item.wfrecon__Amount_Received__c = newAmountReceived;
                            hasChanges = true;
                        }
                    }

                    if (hasChanges) {
                        itemsToUpdate.add(item);
                    }
                }
            }

            if (!itemsToUpdate.isEmpty()) {
                update itemsToUpdate;
            }

            return 'SUCCESS';
        } catch (Exception e) {
            System.debug('Error saving payment line items: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    private static String buildAddress(Account acc) {
        if (acc == null) return '-';
        
        List<String> addressParts = new List<String>();
        
        if (String.isNotBlank(acc.BillingStreet)) {
            addressParts.add(acc.BillingStreet);
        }
        if (String.isNotBlank(acc.BillingCity)) {
            addressParts.add(acc.BillingCity);
        }
        if (String.isNotBlank(acc.BillingState)) {
            addressParts.add(acc.BillingState);
        }
        if (String.isNotBlank(acc.BillingPostalCode)) {
            addressParts.add(acc.BillingPostalCode);
        }
        
        return !addressParts.isEmpty() ? String.join(addressParts, ', ') : '-';
    }

    // ---------------------------
    // Wrapper classes
    // ---------------------------
    public class PaymentDataWrapper {
        @AuraEnabled public PaymentWrapper paymentDetails { get; set; }
        @AuraEnabled public List<wfrecon__Payment_Line_Item__c> paymentLineItems { get; set; }

        public PaymentDataWrapper() {
            paymentDetails = new PaymentWrapper();
            paymentLineItems = new List<wfrecon__Payment_Line_Item__c>();
        }
    }

    public class PaymentWrapper {
        @AuraEnabled public Id Id;
        @AuraEnabled public String Name;
        @AuraEnabled public String AccountName;
        @AuraEnabled public String Address;
        @AuraEnabled public Id BillingId;
        @AuraEnabled public String BillingNumber;
        @AuraEnabled public Id JobId;
        @AuraEnabled public String JobName;
        @AuraEnabled public String JobNumber;
        @AuraEnabled public Date PaymentReceivedDate;
        @AuraEnabled public String PaymentReference;
        @AuraEnabled public Decimal TotalPaidAmount;

        public PaymentWrapper() {}
    }
}