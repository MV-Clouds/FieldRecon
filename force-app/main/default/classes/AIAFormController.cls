public with sharing class AIAFormController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getBillingData(Id recordId) {
        if (!Test.isRunningTest()) {
            // Id = 'a0bKY000001kDcmYAE'; 
            // Id = 'a0bKY000001kHgzYAE'; 
        }
        String companyAddress = '';
        String comName = '';
        Organization org = [SELECT Street, City, State, PostalCode, Country, Name FROM Organization LIMIT 1];
        companyAddress = 
            (org.Street != null ? org.Street + ', ' : '') +
            (org.City != null ? org.City + ', ' : '') +
            (org.State != null ? org.State + ', ' : '') +
            (org.PostalCode != null ? org.PostalCode + ', ' : '') +
            (org.Country != null ? org.Country : '');
        companyAddress = companyAddress.removeEnd(', ');
        comName = org.Name != null ? org.Name : '';
        // System.debug('Company Address123: ' + companyAddress);
        // Fetch one Billing record with all line items
        wfrecon__Billing__c billingRecord = [
            SELECT Id, 
                   wfrecon__Application_Number__c,
                   wfrecon__Contract_Sum_to_Date__c,
                   wfrecon__Total_Billed_Amount__c,
                   wfrecon__Total_Completed_And_Stored_To_Date__c,
                   wfrecon__Retainage_Completed_to_Date__c,
                   wfrecon__Total_Amount_Earned_Less_Retainage__c,
                   wfrecon__Less_Previous_Certificated_for_Payment__c,
                   wfrecon__Current_Payment_Due_FM__c,
                   wfrecon__Balance_to_Finish_Retainage__c,
                   wfrecon__End_Date__c,
                   wfrecon__Retainage_on_Bill__c,
                   wfrecon__Job__r.wfrecon__Job_Name__c,
                   wfrecon__Job__r.Job_Number__c,
                   wfrecon__Job__r.Contract_Date__c,
                   wfrecon__Job__r.wfrecon__Street__c,
                   wfrecon__Job__r.wfrecon__City__c,
                   wfrecon__Job__r.wfrecon__State__c,
                   wfrecon__Job__r.wfrecon__Zip_Code__c,
                   wfrecon__Job__r.wfrecon__Country__c,
                   wfrecon__Job__r.Name,
                   wfrecon__Job__r.wfrecon__Account__r.Name,
                   wfrecon__Job__r.wfrecon__Architect__r.Name,
                   wfrecon__Job__r.wfrecon__Total_Contract_Price__c,
                   wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c,
                   wfrecon__Job__r.wfrecon__Total_Contract_Value__c,
                   wfrecon__Bill_Type__c,
                   (SELECT Id,
                           Name,
                           wfrecon__Bill_Item_Type__c,
                           wfrecon__Scope_Entry__r.Name,
                           wfrecon__Scope_Entry__r.wfrecon__Change_Order_Type__c,
                           wfrecon__Scope_Entry__r.wfrecon__Approved_Date__c,
                           wfrecon__Scope_Contract_Amount__c,
                           wfrecon__Previous_Billed_Value__c,
                           wfrecon__Scope_Entry_Type__c,
                           wfrecon__This_Billing_Value__c,
                           wfrecon__Total_Billing_Value_Retainage__c,
                           wfrecon__Retainage_Percent_on_Bill_Line_Item__c,
                           wfrecon__This_Retainage_Amount__c,
                           wfrecon__Total_Retainage_Amount__c,
                           wfrecon__Previous_Bill_Line_Item__r.wfrecon__Total_Billed_Amount__c,
                           wfrecon__Previous_Bill_Line_Item__r.wfrecon__Total_Retainage_Amount__c,
                           wfrecon__Previous_Bill_Line_Item__r.wfrecon__Retainage_Percent_on_Bill_Line_Item__c
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
            'totalC' => 0.00,
            'totalD' => 0.00,
            'totalE' => 0.00,
            'totalF' => 0.00,
            'totalH' => 0.00,
            'totalI' => 0.00,
            'totalJ' => 0.00
        };

        // Change Order Summary variables
        Decimal previousAddition = 0;
        Decimal previousDeduction = 0;
        Decimal thisMonthAddition = 0;
        Decimal thisMonthDeduction = 0;

        Integer contractSr = 1;
        Integer changeOrderSr = 1;
        
        // Get billing period dates
        Id jobId = billingRecord.wfrecon__Job__c;
        Date billingEndDate = billingRecord.wfrecon__End_Date__c;
        Date billingStartDate = billingEndDate != null ? billingEndDate.toStartOfMonth() : null;
        
        // Query ALL Billing Line Items for ALL billings on this Job (to get cumulative change order amounts)
        List<wfrecon__Billing_Line_Item__c> allJobBillingLines = [
            SELECT Id, Name, wfrecon__Scope_Entry_Type__c, wfrecon__This_Billing_Value__c, wfrecon__Total_Billed_Amount__c,
                   wfrecon__Scope_Entry__r.wfrecon__Change_Order_Type__c, wfrecon__Scope_Entry__r.wfrecon__Approved_Date__c
            FROM wfrecon__Billing_Line_Item__c
            WHERE wfrecon__Billing__c = :billingRecord.Id
            AND wfrecon__Scope_Entry_Type__c = 'Change Order'
            AND wfrecon__Scope_Entry__r.wfrecon__Scope_Entry_Status__c = 'Approved'
        ];
        
        System.debug('Found ' + allJobBillingLines.size() + ' change order billing line items for Job: ' + jobId);
        
        // Process all change order billing line items for the summary
        for (wfrecon__Billing_Line_Item__c line : allJobBillingLines) {
            String changeOrderType = '';
            Date approvedDate = null;
            Decimal thisBillingValue = line.wfrecon__This_Billing_Value__c != null ? line.wfrecon__This_Billing_Value__c : 0;
            Decimal totalBilledAmount = line.wfrecon__Total_Billed_Amount__c != null ? line.wfrecon__Total_Billed_Amount__c : 0;
            
            if (line.wfrecon__Scope_Entry__r != null) {
                changeOrderType = line.wfrecon__Scope_Entry__r.wfrecon__Change_Order_Type__c;
                approvedDate = line.wfrecon__Scope_Entry__r.wfrecon__Approved_Date__c;
            }
            
            Boolean isThisMonth = false;
            if (approvedDate != null && billingStartDate != null) {
                isThisMonth = (approvedDate >= billingStartDate);
            }
            
            System.debug('Billing Line: ' + line.Name + ', Type: ' + changeOrderType + ', Approved: ' + approvedDate + ', This Billing Value: ' + totalBilledAmount + ', isThisMonth: ' + isThisMonth);
            
            if (changeOrderType == 'Addition') {
                if (isThisMonth) {
                    thisMonthAddition += totalBilledAmount;
                } else {
                    previousAddition += totalBilledAmount;
                }
            } else if (changeOrderType == 'Deduction') {
                if (isThisMonth) {
                    thisMonthDeduction += Math.abs(totalBilledAmount);
                } else {
                    previousDeduction += Math.abs(totalBilledAmount);
                }
            }
        }

        // Loop line items and split/sum them
        if (billingRecord.wfrecon__Billing_Line_Items__r != null) {
            for (wfrecon__Billing_Line_Item__c line : billingRecord.wfrecon__Billing_Line_Items__r) {
                String type = line.wfrecon__Scope_Entry_Type__c;
                if (String.isBlank(type)) type = 'Unknown';

                String billType = billingRecord.wfrecon__Bill_Type__c;
                
                Decimal contractAmt = line.wfrecon__Scope_Contract_Amount__c != null ? line.wfrecon__Scope_Contract_Amount__c : 0.00;
                Decimal prevBilledValue = line.wfrecon__Previous_Bill_Line_Item__r != null ? line.wfrecon__Previous_Bill_Line_Item__r.wfrecon__Total_Billed_Amount__c : 0.00;
                Decimal retainagePercent = line.wfrecon__Retainage_Percent_on_Bill_Line_Item__c != null ? line.wfrecon__Retainage_Percent_on_Bill_Line_Item__c : 0.00;
                Decimal thisRetainageAmount = line.wfrecon__This_Retainage_Amount__c != null ? line.wfrecon__This_Retainage_Amount__c : 0.00;
                Decimal totalRetainageAmount = line.wfrecon__Total_Retainage_Amount__c != null ? line.wfrecon__Total_Retainage_Amount__c : 0.00;
                Decimal prevTotalRetainageAmount = line.wfrecon__Previous_Bill_Line_Item__r != null ? line.wfrecon__Previous_Bill_Line_Item__r.wfrecon__Total_Retainage_Amount__c : 0.00;
                Decimal thisBillingValueDecimal = (billType == 'Regular') ? line.wfrecon__This_Billing_Value__c : prevTotalRetainageAmount;
                Decimal thisBillingValueWithRetainageDecimal = (billType == 'Regular') ? (thisBillingValueDecimal + thisRetainageAmount) : prevTotalRetainageAmount;

                // Safely compute value of G
                Decimal valueOfG = 0.00;
                if (contractAmt != 0.00) {
                    valueOfG = ((prevBilledValue + thisBillingValueWithRetainageDecimal) / contractAmt)*100;
                }

                Map<String, Object> lineMap = new Map<String, Object>{
                    'Sr_No__c' => (type == 'Contract' ? contractSr : changeOrderSr),
                    'Id' => line.Id,
                    'Name' => line.Name,
                    'wfrecon__Scope_Entry__r' => line.wfrecon__Scope_Entry__r != null ? line.wfrecon__Scope_Entry__r.Name : '',
                    'wfrecon__Scope_Contract_Amount__c' => formatCurrency(contractAmt),
                    'wfrecon__Previous_Billed_Value__c' => formatCurrency(prevBilledValue),
                    'wfrecon__This_Billing_Value__c' => formatCurrency(thisBillingValueWithRetainageDecimal),
                    'sumD_E' => formatCurrency(prevBilledValue + thisBillingValueWithRetainageDecimal),
                    'vlueOf_G' => formatCurrency(valueOfG),
                    'vlueof_H' => formatCurrency(contractAmt - (prevBilledValue + thisBillingValueWithRetainageDecimal)),
                    'wfrecon__Retainage_Percent_on_Bill_Line_Item__c' => formatCurrency(retainagePercent),
                    'wfrecon__This_Retainage_Amount__c' => formatCurrency(thisRetainageAmount),
                    'wfrecon__Total_Retainage_Amount__c' => formatCurrency(totalRetainageAmount),
                    'wfrecon__Prev_Total_Retainage_Amount__c' => formatCurrency(prevTotalRetainageAmount),
                    'wfrecon__Bill_Item_Type__c' => line.wfrecon__Bill_Item_Type__c,
                    'wfrecon__Scope_Entry_Type__c' => type
                };

                if (type == 'Contract') {
                    contractList.add(lineMap);
                    contractSr++;

                    contractSums.put('totalC', contractSums.get('totalC') + (contractAmt));
                    contractSums.put('totalD', contractSums.get('totalD') + (prevBilledValue));
                    contractSums.put('totalE', contractSums.get('totalE') + (thisBillingValueWithRetainageDecimal));
                    contractSums.put('totalF', contractSums.get('totalF') + (prevBilledValue + thisBillingValueWithRetainageDecimal));
                    contractSums.put('totalH', contractSums.get('totalH') + (contractAmt - (prevBilledValue + thisBillingValueWithRetainageDecimal)));
                    contractSums.put('totalI', contractSums.get('totalI') + (thisRetainageAmount));
                    contractSums.put('totalJ', contractSums.get('totalJ') + (prevTotalRetainageAmount));
                } 
                else if (type == 'Change Order') {
                    changeOrderList.add(lineMap);
                    changeOrderSr++;

                    contractSums.put('totalC', contractSums.get('totalC') + (contractAmt));
                    contractSums.put('totalD', contractSums.get('totalD') + (prevBilledValue));
                    contractSums.put('totalE', contractSums.get('totalE') + (thisBillingValueWithRetainageDecimal));
                    contractSums.put('totalF', contractSums.get('totalF') + (prevBilledValue + thisBillingValueWithRetainageDecimal));
                    contractSums.put('totalH', contractSums.get('totalH') + (contractAmt - (prevBilledValue + thisBillingValueWithRetainageDecimal)));
                    contractSums.put('totalI', contractSums.get('totalI') + (thisRetainageAmount));
                    contractSums.put('totalJ', contractSums.get('totalJ') + (prevTotalRetainageAmount));
                }
            }
        }
        
        // Calculate totals for change order summary
        Decimal totalAddition = previousAddition + thisMonthAddition;
        Decimal totalDeduction = previousDeduction + thisMonthDeduction;
        Decimal netChanges = totalAddition - totalDeduction; // Subtract deductions from additions
        
        System.debug('Previous Addition: ' + previousAddition);
        System.debug('This Month Addition: ' + thisMonthAddition);
        System.debug('Previous Deduction: ' + previousDeduction);
        System.debug('This Month Deduction: ' + thisMonthDeduction);
        System.debug('Total Addition: ' + totalAddition);
        System.debug('Total Deduction: ' + totalDeduction);
        System.debug('Net Changes: ' + netChanges);
        
        // Populate change order summary
        changeOrderSummary.put('previousAddition', previousAddition);
        changeOrderSummary.put('previousDeduction', previousDeduction);
        changeOrderSummary.put('thisMonthAddition', thisMonthAddition);
        changeOrderSummary.put('thisMonthDeduction', thisMonthDeduction);
        changeOrderSummary.put('totalAddition', totalAddition);
        changeOrderSummary.put('totalDeduction', totalDeduction);
        changeOrderSummary.put('netChanges', netChanges);

        changeOrderSummary.put('companyAddress', companyAddress);
        changeOrderSummary.put('comName', comName);

        System.debug('Change Order Summary: ' + JSON.serialize(changeOrderSummary));

        // Prepare result
        Map<String, Object> result = new Map<String, Object>();
        result.put('billingRecord', billingRecord);
        result.put('contractLineItems', contractList);
        result.put('changeOrderLineItems', changeOrderList);
        result.put('contractSums', contractSums);
        result.put('changeOrderSummary', changeOrderSummary);

        return result;
    }
    
    public static String formatCurrency(Decimal inputValue) {
        try {
            Decimal amount = inputValue != null ? inputValue : 0.00;
            String s = ( amount.setScale(2) + 0.001 ).format();
            String p = s.substring(0,s.length()-1);
            return P;
        } catch (Exception e) {
            // Fallback if any conversion error
            return '0.00';
        }
    }
}