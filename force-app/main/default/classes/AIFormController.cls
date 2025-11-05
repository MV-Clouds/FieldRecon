public with sharing class AIFormController {

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getBillingData(Id recordId) {
        if (!Test.isRunningTest()) {
            // Id = 'a0bKY000001kDcmYAE'; 
            // Id = 'a0bKY000001kHgzYAE'; 
        }
        String companyAddress = '';
        Organization org = [SELECT Street, City, State, PostalCode, Country FROM Organization LIMIT 1];
        companyAddress = 
            (org.Street != null ? org.Street + ', ' : '') +
            (org.City != null ? org.City + ', ' : '') +
            (org.State != null ? org.State + ', ' : '') +
            (org.PostalCode != null ? org.PostalCode + ', ' : '') +
            (org.Country != null ? org.Country : '');
        companyAddress = companyAddress.removeEnd(', ');
        // System.debug('Company Address123: ' + companyAddress);
        // Fetch one Billing record with all line items
        wfrecon__Billing__c billingRecord = [
            SELECT Id, 
                   wfrecon__Application_Number__c,
                   wfrecon__Contract_Sum_to_Date__c,
                   wfrecon__Total_Billed_Amount__c,
                   wfrecon__Retainage_Completed_to_Date__c,
                   wfrecon__Total_Amount_Earned_Less_Retainage__c,
                   wfrecon__Less_Previous_Certificated_for_Payment__c,
                   wfrecon__Current_Payment_Due_FM__c,
                   wfrecon__Balance_to_Finish_Retainage__c,
                   wfrecon__Job__r.wfrecon__Job_Name__c,
                   wfrecon__Job__r.Name,
                   wfrecon__Job__r.wfrecon__Architect__r.Name,
                   wfrecon__Job__r.wfrecon__Total_Contract_Price__c,
                   wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c,
                   (SELECT Id,
                           Name,
                           wfrecon__Bill_Item_Type__c,
                           wfrecon__Scope_Entry__r.Name,
                           wfrecon__Scope_Entry__r.wfrecon__Change_Order_Type__c,
                           wfrecon__Scope_Entry__r.wfrecon__Approved_Date__c,
                           wfrecon__Scope_Contract_Amount__c,
                           wfrecon__Previous_Billed_Percent__c,
                           wfrecon__Previous_Billed_Value__c,
                           wfrecon__This_Billing_Percent__c,
                           wfrecon__Total_Billing_Value_Retainage__c,
                           wfrecon__This_Retainage_Amount__c,
                           wfrecon__Scope_Entry_Type__c 
                    FROM wfrecon__Billing_Line_Items__r)
            FROM wfrecon__Billing__c 
            WHERE Id =: recordId
            LIMIT 1
        ];

        // Prepare two lists & sums: Contract and Change Order
        List<Map<String, Object>> contractList = new List<Map<String, Object>>();
        List<Map<String, Object>> changeOrderList = new List<Map<String, Object>>();
        Map<String, Object> changeOrderSummary = new Map<String, Object>();

        Map<String, Decimal> contractSums = new Map<String, Decimal>{
            'Previous_Billed_Percent' => 0,
            'Previous_Billed_Value' => 0,
            'This_Billing_Percent' => 0,
            'Total_Billing_Value_Retainage' => 0,
            'This_Retainage_Amount' => 0
        };

        Map<String, Decimal> changeOrderSums = new Map<String, Decimal>{
            'Previous_Billed_Percent' => 0,
            'Previous_Billed_Value' => 0,
            'This_Billing_Percent' => 0,
            'Total_Billing_Value_Retainage' => 0,
            'This_Retainage_Amount' => 0
        };

        // Change Order Summary variables
        Decimal previousAddition = 0;
        Decimal previousDeduction = 0;
        Decimal thisMonthAddition = 0;
        Decimal thisMonthDeduction = 0;

        Integer contractSr = 1;
        Integer changeOrderSr = 1;

        // Loop line items and split/sum them
        if (billingRecord.wfrecon__Billing_Line_Items__r != null) {
            for (wfrecon__Billing_Line_Item__c line : billingRecord.wfrecon__Billing_Line_Items__r) {
                String type = line.wfrecon__Scope_Entry_Type__c;
                if (String.isBlank(type)) type = 'Unknown';

                Map<String, Object> lineMap = new Map<String, Object>{
                    'Sr_No__c' => (type == 'Contract' ? contractSr : changeOrderSr),
                    'Id' => line.Id,
                    'Name' => line.Name,
                    'wfrecon__Bill_Item_Type__c' => line.wfrecon__Bill_Item_Type__c,
                    'wfrecon__Scope_Entry__r' => line.wfrecon__Scope_Entry__r != null ? line.wfrecon__Scope_Entry__r.Name : '',
                    'wfrecon__Previous_Billed_Percent__c' => line.wfrecon__Previous_Billed_Percent__c,
                    'wfrecon__Previous_Billed_Value__c' => line.wfrecon__Previous_Billed_Value__c,
                    'wfrecon__This_Billing_Percent__c' => line.wfrecon__This_Billing_Percent__c,
                    'wfrecon__Total_Billing_Value_Retainage__c' => line.wfrecon__Total_Billing_Value_Retainage__c,
                    'wfrecon__This_Retainage_Amount__c' => line.wfrecon__This_Retainage_Amount__c,
                    'wfrecon__Scope_Entry_Type__c' => type
                };

                if (type == 'Contract') {
                    contractList.add(lineMap);
                    contractSr++;

                    contractSums.put('Previous_Billed_Percent', contractSums.get('Previous_Billed_Percent') + (line.wfrecon__Previous_Billed_Percent__c != null ? line.wfrecon__Previous_Billed_Percent__c : 0));
                    contractSums.put('Previous_Billed_Value', contractSums.get('Previous_Billed_Value') + (line.wfrecon__Previous_Billed_Value__c != null ? line.wfrecon__Previous_Billed_Value__c : 0));
                    contractSums.put('This_Billing_Percent', contractSums.get('This_Billing_Percent') + (line.wfrecon__This_Billing_Percent__c != null ? line.wfrecon__This_Billing_Percent__c : 0));
                    contractSums.put('Total_Billing_Value_Retainage', contractSums.get('Total_Billing_Value_Retainage') + (line.wfrecon__Total_Billing_Value_Retainage__c != null ? line.wfrecon__Total_Billing_Value_Retainage__c : 0));
                    contractSums.put('This_Retainage_Amount', contractSums.get('This_Retainage_Amount') + (line.wfrecon__This_Retainage_Amount__c != null ? line.wfrecon__This_Retainage_Amount__c : 0));
                } 
                else if (type == 'Change Order') {
                    changeOrderList.add(lineMap);
                    changeOrderSr++;

                    changeOrderSums.put('Previous_Billed_Percent', changeOrderSums.get('Previous_Billed_Percent') + (line.wfrecon__Previous_Billed_Percent__c != null ? line.wfrecon__Previous_Billed_Percent__c : 0));
                    changeOrderSums.put('Previous_Billed_Value', changeOrderSums.get('Previous_Billed_Value') + (line.wfrecon__Previous_Billed_Value__c != null ? line.wfrecon__Previous_Billed_Value__c : 0));
                    changeOrderSums.put('This_Billing_Percent', changeOrderSums.get('This_Billing_Percent') + (line.wfrecon__This_Billing_Percent__c != null ? line.wfrecon__This_Billing_Percent__c : 0));
                    changeOrderSums.put('Total_Billing_Value_Retainage', changeOrderSums.get('Total_Billing_Value_Retainage') + (line.wfrecon__Total_Billing_Value_Retainage__c != null ? line.wfrecon__Total_Billing_Value_Retainage__c : 0));
                    changeOrderSums.put('This_Retainage_Amount', changeOrderSums.get('This_Retainage_Amount') + (line.wfrecon__This_Retainage_Amount__c != null ? line.wfrecon__This_Retainage_Amount__c : 0));
                    
                    // Get the Change Order Type and Approved Date from Scope Entry
                    String changeOrderType = '';
                    Date approvedDate = null;
                    Decimal scopeContractAmount = (line.wfrecon__Scope_Contract_Amount__c != null ? line.wfrecon__Scope_Contract_Amount__c : 0);
                    System.debug('Processing Change Order Line Item: ' + line.Id + ' with Scope Contract Amount: ' + scopeContractAmount);
                    
                    if (line.wfrecon__Scope_Entry__r != null) {
                        if (line.wfrecon__Scope_Entry__r.wfrecon__Change_Order_Type__c != null) {
                            changeOrderType = line.wfrecon__Scope_Entry__r.wfrecon__Change_Order_Type__c;
                        }
                        if (line.wfrecon__Scope_Entry__r.wfrecon__Approved_Date__c != null) {
                            approvedDate = line.wfrecon__Scope_Entry__r.wfrecon__Approved_Date__c;
                        }
                    }
                    
                    // Get current month and year
                    Date today = Date.today();
                    Integer currentMonth = today.month();
                    Integer currentYear = today.year();
                    
                    // Determine if this billing line item is from this month or previous months
                    Boolean isThisMonth = false;
                    if (approvedDate != null) {
                        isThisMonth = (approvedDate.month() == currentMonth && approvedDate.year() == currentYear);
                    }
                    
                    System.debug('Change Order Type: ' + changeOrderType + ', Approved Date: ' + approvedDate + ', isThisMonth: ' + isThisMonth);
                    // Calculate based on Addition or Deduction type
                    if (changeOrderType == 'Addition') {
                        if (isThisMonth) {
                            thisMonthAddition += scopeContractAmount;
                        } else {
                            previousAddition += scopeContractAmount;
                        }
                    } else if (changeOrderType == 'Deduction') {
                        // Deduction is already stored as negative in Scope_Contract_Amount__c
                        if (isThisMonth) {
                            thisMonthDeduction += scopeContractAmount;
                        } else {
                            previousDeduction += scopeContractAmount;
                        }
                    }
                }
            }
        }
        
        // Calculate totals for change order summary
        Decimal totalAddition = previousAddition + thisMonthAddition;
        Decimal totalDeduction = previousDeduction + thisMonthDeduction;
        Decimal netChanges = totalAddition + totalDeduction; // Deduction is stored as negative in Scope_Contract_Amount__c
        
        // Populate change order summary
        changeOrderSummary.put('previousAddition', previousAddition);
        changeOrderSummary.put('previousDeduction', previousDeduction);
        changeOrderSummary.put('thisMonthAddition', thisMonthAddition);
        changeOrderSummary.put('thisMonthDeduction', thisMonthDeduction);
        changeOrderSummary.put('totalAddition', totalAddition);
        changeOrderSummary.put('totalDeduction', totalDeduction);
        changeOrderSummary.put('netChanges', netChanges);

        // billingRecord.put('companyAddress', companyAddress);

        System.debug('Change Order Summary: ' + JSON.serialize(changeOrderSummary));

        // Prepare result
        Map<String, Object> result = new Map<String, Object>();
        result.put('billingRecord', billingRecord);
        result.put('contractLineItems', contractList);
        result.put('changeOrderLineItems', changeOrderList);
        result.put('contractSums', contractSums);
        result.put('changeOrderSums', changeOrderSums);
        result.put('changeOrderSummary', changeOrderSummary);

        return result;
    }
}