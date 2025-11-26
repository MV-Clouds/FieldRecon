// /**
// * Class Name: JobMetricsController
// * Test Class: 
// * @description: Controller for Job data Report
// * Created Date: 25 November 2025
// * Created By: Kajal Tiwari
// *--------------------------------------------------------------------------------
// * Modification History:
// * Date Modified - Developer Name - Description
// * 
// **/

public with sharing class JobMetricsController {
    
    /*
    *********************************************************
    @description     : Method to get all jobs with their scope entry data for calculations
    @return          : List<JobData> - List of jobs with calculated metrics
    ********************************************************
    */
    @AuraEnabled(cacheable=true)
    public static List<JobData> getAllJobsWithScopeData() {
        List<JobData> jobDataList = new List<JobData>();
        
        try {
            // Get all jobs with financial data
            List<wfrecon__Job__c> jobs = [
                SELECT Id, Name, wfrecon__Job_Name__c,
                       wfrecon__Total_Contract_Price__c, 
                       wfrecon__Total_Contract_Value__c,
                       wfrecon__Total_Change_Order_Value__c
                FROM wfrecon__Job__c
                WITH USER_MODE
                ORDER BY Name
            ];
            
            if (jobs.isEmpty()) {
                return jobDataList;
            }
            
            // Get job IDs for all queries
            Set<Id> jobIds = new Set<Id>();
            for (wfrecon__Job__c job : jobs) {
                jobIds.add(job.Id);
            }
            
            // 1. Aggregate scope entry data by job to get total completed value
            Map<Id, Decimal> jobCompletedValueMap = new Map<Id, Decimal>();
            AggregateResult[] scopeResults = [
                SELECT wfrecon__Job__c jobId, 
                       SUM(wfrecon__Current_Complete_Value__c) totalCompleted
                FROM wfrecon__Scope_Entry__c
                WHERE wfrecon__Job__c IN :jobIds
                AND wfrecon__Current_Complete_Value__c != null
                WITH USER_MODE
                GROUP BY wfrecon__Job__c
            ];
            
            for (AggregateResult ar : scopeResults) {
                Id jobId = (Id)ar.get('jobId');
                Decimal totalCompleted = (Decimal)ar.get('totalCompleted');
                jobCompletedValueMap.put(jobId, totalCompleted);
            }
            
            // 2. Get most recent approved bill for each job
            Map<Id, wfrecon__Billing__c> latestApprovedBillsMap = new Map<Id, wfrecon__Billing__c>();
            
            // Query for the most recent approved bill per job
            for (wfrecon__Billing__c bill : [
                SELECT Id, wfrecon__Job__c, wfrecon__Total_Billed_Amount__c, 
                       wfrecon__Retainage_Completed_to_Date__c, CreatedDate
                FROM wfrecon__Billing__c
                WHERE wfrecon__Job__c IN :jobIds
                AND wfrecon__Status__c = 'Approved'
                WITH USER_MODE
                ORDER BY wfrecon__Job__c, CreatedDate DESC
            ]) {
                // Only keep the most recent bill for each job
                if (!latestApprovedBillsMap.containsKey(bill.wfrecon__Job__c)) {
                    latestApprovedBillsMap.put(bill.wfrecon__Job__c, bill);
                }
            }
            
            // 3. Aggregate payment data by job
            Map<Id, Decimal> jobTotalPaymentsMap = new Map<Id, Decimal>();
            AggregateResult[] paymentResults = [
                SELECT wfrecon__Job__c jobId, 
                       SUM(wfrecon__Payable_Amount_Received__c) totalPaid
                FROM wfrecon__Payment__c
                WHERE wfrecon__Job__c IN :jobIds
                AND wfrecon__Payable_Amount_Received__c != null
                WITH USER_MODE
                GROUP BY wfrecon__Job__c
            ];
            
            for (AggregateResult ar : paymentResults) {
                Id jobId = (Id)ar.get('jobId');
                Decimal totalPaid = (Decimal)ar.get('totalPaid');
                jobTotalPaymentsMap.put(jobId, totalPaid);
            }
            
            // Create JobData objects with all calculations
            for (wfrecon__Job__c job : jobs) {
                JobData data = new JobData();
                data.jobId = job.Id;
                data.jobName = job.wfrecon__Job_Name__c;
                data.baseContract = job.wfrecon__Total_Contract_Value__c != null ? job.wfrecon__Total_Contract_Value__c : 0;
                data.changeOrder = job.wfrecon__Total_Change_Order_Value__c != null ? job.wfrecon__Total_Change_Order_Value__c : 0;
                data.totalCompletedValue = jobCompletedValueMap.get(job.Id) != null ? jobCompletedValueMap.get(job.Id) : 0;
                
                // Calculate total contract
                Decimal totalContract = data.baseContract + data.changeOrder;
                
                // Billing data
                wfrecon__Billing__c latestBill = latestApprovedBillsMap.get(job.Id);
                if (latestBill != null) {
                    // Use the most recent approved bill's Total Billed Amount
                    data.billedAmount = latestBill.wfrecon__Total_Billed_Amount__c != null ? latestBill.wfrecon__Total_Billed_Amount__c : 0;
                    // Use the most recent approved bill's Retainage Completed to Date
                    data.retainageHeld = latestBill.wfrecon__Retainage_Completed_to_Date__c != null ? latestBill.wfrecon__Retainage_Completed_to_Date__c : 0;
                } else {
                    data.billedAmount = 0;
                    data.retainageHeld = 0;
                }
                
                // Payment data - sum of all payments
                data.paidAmount = jobTotalPaymentsMap.get(job.Id) != null ? jobTotalPaymentsMap.get(job.Id) : 0;
                
                // Balance calculation: Total Contract - Billed Amount (from most recent approved bill only)
                Decimal totalBilledRecent = latestBill != null ? latestBill.wfrecon__Total_Billed_Amount__c : 0;
                data.balanceAmount = totalContract - totalBilledRecent;
                
                jobDataList.add(data);
            }
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobMetricsController', 'methodName' => 'getAllJobsWithScopeData', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
        
        return jobDataList;
    }
    
    /*
    *********************************************************
    @description     : Method to get job metrics for dashboard cards
    @return          : Map<String, MetricData> - Status related data
    ********************************************************
    */
    @AuraEnabled(cacheable=true)
    public static Map<String, MetricData> getJobMetrics() {
        Map<String, MetricData> metrics = new Map<String, MetricData>();
        
        try {
            // Aggregate query to get count and sum by status
            AggregateResult[] results = [
                SELECT wfrecon__Status__c status, 
                       COUNT(Id) recordCount, 
                       SUM(wfrecon__Total_Contract_Price__c) totalValue
                FROM wfrecon__Job__c 
                WHERE wfrecon__Status__c IN ('Backlog', 'In Progress', 'Outstanding', 'Retainage Pending', 'Closed')
                GROUP BY wfrecon__Status__c
            ];
            
            // Initialize all statuses with zero values
            metrics.put('backlog', new MetricData(0, 0));
            metrics.put('inProgress', new MetricData(0, 0));
            metrics.put('outstanding', new MetricData(0, 0));
            metrics.put('retainagePending', new MetricData(0, 0));
            metrics.put('close', new MetricData(0, 0));
            
            // Process aggregate results
            for (AggregateResult ar : results) {
                String status = (String)ar.get('status');
                Integer count = (Integer)ar.get('recordCount');
                Decimal totalValue = (Decimal)ar.get('totalValue');
                
                if (totalValue == null) totalValue = 0;
                
                switch on status {
                    when 'Backlog' {
                        metrics.put('backlog', new MetricData(count, totalValue));
                    }
                    when 'In Progress' {
                        metrics.put('inProgress', new MetricData(count, totalValue));
                    }
                    when 'Outstanding' {
                        metrics.put('outstanding', new MetricData(count, totalValue));
                    }
                    when 'Retainage Pending' {
                        metrics.put('retainagePending', new MetricData(count, totalValue));
                    }
                    when 'Close' {
                        metrics.put('close', new MetricData(count, totalValue));
                    }
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobMetricsController', 'methodName' => 'getJobMetrics', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
        
        return metrics;
    }
    
    // Wrapper class for job data
    public class JobData {
        @AuraEnabled public String jobId { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public Decimal baseContract { get; set; }
        @AuraEnabled public Decimal changeOrder { get; set; }
        @AuraEnabled public Decimal totalCompletedValue { get; set; }
        @AuraEnabled public Decimal billedAmount { get; set; }
        @AuraEnabled public Decimal paidAmount { get; set; }
        @AuraEnabled public Decimal balanceAmount { get; set; }
        @AuraEnabled public Decimal retainageHeld { get; set; }
        
        public JobData() {
            this.baseContract = 0;
            this.changeOrder = 0;
            this.totalCompletedValue = 0;
            this.billedAmount = 0;
            this.paidAmount = 0;
            this.balanceAmount = 0;
            this.retainageHeld = 0;
        }
    }
    
    // Metric data class for dashboard
    public class MetricData {
        @AuraEnabled
        public Integer count { get; set; }
        @AuraEnabled
        public Decimal totalValue { get; set; }
        
        public MetricData(Integer count, Decimal totalValue) {
            this.count = count;
            this.totalValue = totalValue;
        }
    }
}