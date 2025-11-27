// // /**
// // * Class Name: JobMetricsController
// // * Test Class: 
// // * @description: Controller for Job data Report
// // * Created Date: 27 November 2025
// // * Created By: Kajal Tiwari
// // *--------------------------------------------------------------------------------
// // * Modification History:
// // * Date Modified - Developer Name - Description
// // * 
// // **/

public with sharing class JobMetricsController {
    
    public class MetricData {
        @AuraEnabled public Integer count { get; set; }
        @AuraEnabled public Decimal totalValue { get; set; }
        
        public MetricData() {
            this.count = 0;
            this.totalValue = 0;
        }
    }

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
                SELECT Id, Name, wfrecon__Job_Name__c, wfrecon__Status__c, wfrecon__Job_Number__c,
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
                data.jobNumber = job.wfrecon__Job_Number__c;
                data.status = job.wfrecon__Status__c;
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
    @description     : Method to get job metrics for dashboard cards with custom metadata
    @return          : Map<String, MetricData> - Status related data
    ********************************************************
    */
    @AuraEnabled(cacheable=true)
    public static Map<String, MetricData> getJobMetrics() {
        Map<String, MetricData> metrics = new Map<String, MetricData>();
        
        try {
            // Get metric settings from custom metadata
            List<wfrecon__JobMetricSetting__mdt> metricSettings = [
                SELECT MasterLabel, DeveloperName, wfrecon__Statuses__c 
                FROM wfrecon__JobMetricSetting__mdt 
                WITH USER_MODE
            ];
            
            // Collect all statuses from all metrics
            Set<String> allStatuses = new Set<String>();
            Map<String, Set<String>> metricToStatuses = new Map<String, Set<String>>();
            
            // Initialize metrics for all custom metadata records
            for (wfrecon__JobMetricSetting__mdt setting : metricSettings) {
                metrics.put(setting.DeveloperName, new MetricData());
                
                if (setting.wfrecon__Statuses__c != null) {
                    Set<String> statusSet = new Set<String>();
                    List<String> statusList = setting.wfrecon__Statuses__c.split(',');
                    for (String status : statusList) {
                        statusSet.add(status.trim());
                    }
                    metricToStatuses.put(setting.DeveloperName, statusSet);
                    allStatuses.addAll(statusSet);
                }
            }

            if (allStatuses.isEmpty()) {
                System.debug('=== No statuses found in custom metadata');
                return metrics;
            }
            
            // Get all jobs with their financial data
            List<wfrecon__Job__c> jobs = [
                SELECT Id, Name, wfrecon__Status__c, 
                    wfrecon__Total_Contract_Price__c,
                    wfrecon__Total_Paid_Amount__c  
                FROM wfrecon__Job__c 
                WHERE wfrecon__Status__c IN :allStatuses
                WITH USER_MODE
            ];
            
            if (jobs.isEmpty()) {
                System.debug('=== No jobs found with the specified statuses');
                return metrics;
            }
            
            // Get job IDs for billing query only
            Set<Id> jobIds = new Set<Id>();
            for (wfrecon__Job__c job : jobs) {
                jobIds.add(job.Id);
            }
            
            // Get most recent approved bill for each job
            Map<Id, wfrecon__Billing__c> latestApprovedBillsMap = new Map<Id, wfrecon__Billing__c>();
            for (wfrecon__Billing__c bill : [
                SELECT Id, wfrecon__Job__c, wfrecon__Total_Billed_Amount__c, CreatedDate
                FROM wfrecon__Billing__c
                WHERE wfrecon__Job__c IN :jobIds
                AND wfrecon__Status__c = 'Approved'
                WITH USER_MODE
                ORDER BY wfrecon__Job__c, CreatedDate DESC
            ]) {
                if (!latestApprovedBillsMap.containsKey(bill.wfrecon__Job__c)) {
                    latestApprovedBillsMap.put(bill.wfrecon__Job__c, bill);
                }
            }
                        
            // Calculate metrics for each job based on custom settings
            for (wfrecon__Job__c job : jobs) {
                Decimal totalContract = job.wfrecon__Total_Contract_Price__c != null ? job.wfrecon__Total_Contract_Price__c : 0;

                wfrecon__Billing__c latestBill = latestApprovedBillsMap.get(job.Id);
                Decimal recentBilledAmount = latestBill != null && latestBill.wfrecon__Total_Billed_Amount__c != null ? 
                                        latestBill.wfrecon__Total_Billed_Amount__c : 0;
                
                Decimal totalPaidAmount = job.Total_Paid_Amount__c != null ? job.Total_Paid_Amount__c : 0;
                
                Decimal openBalance = recentBilledAmount - totalPaidAmount;
                Decimal pendingAmount = totalContract - recentBilledAmount;
                                
                for (String metricName : metricToStatuses.keySet()) {
                    Set<String> statuses = metricToStatuses.get(metricName);
                    if (statuses != null && statuses.contains(job.wfrecon__Status__c)) {
                        MetricData currentMetric = metrics.get(metricName);
                        if (currentMetric != null) {
                            currentMetric.count++;
                            
                            if (metricName == 'openBalance') {
                                currentMetric.totalValue += openBalance;
                                System.debug('=== Added to ' + metricName + ': openBalance = ' + openBalance);
                            } else if (metricName == 'workRemaining') {
                                currentMetric.totalValue += pendingAmount;
                                System.debug('=== Added to ' + metricName + ': pendingAmount = ' + pendingAmount);
                            } else {
                                // For backlog, inProgress, retainagePending - use total contract value
                                currentMetric.totalValue += totalContract;
                                System.debug('=== Added to ' + metricName + ': totalContract = ' + totalContract);
                            }
                        }
                    }
                }
            }
                        
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobMetricsController', 'methodName' => 'getJobMetrics', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});

            return initializeEmptyMetrics();
        }
        
        return metrics;
    }
    
    /*
    *********************************************************
    @description     : Method to get metric settings for popup
    @return          : Map<String, Object> - Metric settings and status options
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getMetricSettings() {
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // Get all available status picklist values
            List<Map<String, String>> statusOptions = new List<Map<String, String>>();
            Schema.DescribeFieldResult fieldResult = wfrecon__Job__c.wfrecon__Status__c.getDescribe();
            List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
            
            for (Schema.PicklistEntry entry : ple) {
                if (entry.isActive()) {
                    statusOptions.add(new Map<String, String>{
                        'label' => entry.getLabel(),
                        'value' => entry.getValue()
                    });
                }
            }
            
            // Get current metric settings from custom metadata
            List<wfrecon__JobMetricSetting__mdt> metricSettings = [
                SELECT MasterLabel, DeveloperName, wfrecon__Statuses__c 
                FROM wfrecon__JobMetricSetting__mdt 
                WITH USER_MODE
            ];
            
            Map<String, List<String>> metricStatusMap = new Map<String, List<String>>();
            
            // Define default metric names
            List<String> defaultMetrics = new List<String>{
                'backlog', 'inProgress', 'openBalance', 'retainagePending', 'workRemaining'
            };
            
            for (String metricName : defaultMetrics) {
                metricStatusMap.put(metricName, new List<String>());
            }
            
            // Populate with existing settings
            for (wfrecon__JobMetricSetting__mdt setting : metricSettings) {
                if (setting.wfrecon__Statuses__c != null) {
                    metricStatusMap.put(setting.DeveloperName, setting.wfrecon__Statuses__c.split(','));
                }
            }
            
            result.put('statusOptions', statusOptions);
            result.put('metricStatusMap', metricStatusMap);
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobMetricsController', 'methodName' => 'getMetricSettings', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});

        }
        
        return result;
    }
    
    /*
    *********************************************************
    @description     : Method to save metric settings using Metadata API
    @param           : Map<String, List<String>> - Metric to statuses mapping
    ********************************************************
    */
    @AuraEnabled
    public static void saveMetricSettings(Map<String, List<String>> metricStatusMap) {
        try {
            // Use Metadata API to create/update custom metadata records
            List<Metadata.CustomMetadata> customMetadataList = new List<Metadata.CustomMetadata>();
            
            for (String metricName : metricStatusMap.keySet()) {
                List<String> statuses = metricStatusMap.get(metricName);
                String statusesString = String.join(statuses, ',');
                
                // Create custom metadata record
                Metadata.CustomMetadata customMetadata = new Metadata.CustomMetadata();
                customMetadata.fullName = 'wfrecon__JobMetricSetting__mdt.' + metricName;
                customMetadata.label = metricName;
                
                // Create statuses field value
                Metadata.CustomMetadataValue statusesField = new Metadata.CustomMetadataValue();
                statusesField.field = 'wfrecon__Statuses__c';
                statusesField.value = statusesString;
                
                customMetadata.values = new List<Metadata.CustomMetadataValue> { statusesField };
                customMetadataList.add(customMetadata);
            }
            
            // Deploy the metadata
            if (!customMetadataList.isEmpty()) {
                Metadata.DeployContainer mdContainer = new Metadata.DeployContainer();
                for (Metadata.CustomMetadata cm : customMetadataList) {
                    mdContainer.addMetadata(cm);
                }
                
                // Perform deployment
                Id asyncResultId = Metadata.Operations.enqueueDeployment(mdContainer, null);
            }
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobMetricsController', 'methodName' => 'saveMetricSettings', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});

        }
    }
    
    /*
    *********************************************************
    @description     : Initialize empty metrics
    @return          : Map<String, MetricData> - Empty metrics
    ********************************************************
    */
    private static Map<String, MetricData> initializeEmptyMetrics() {
        Map<String, MetricData> emptyMetrics = new Map<String, MetricData>();
        emptyMetrics.put('backlog', new MetricData());
        emptyMetrics.put('inProgress', new MetricData());
        emptyMetrics.put('openBalance', new MetricData());
        emptyMetrics.put('retainagePending', new MetricData());
        emptyMetrics.put('workRemaining', new MetricData());
        return emptyMetrics;
    }

    // Wrapper class for job data
    public class JobData {
        @AuraEnabled public String jobId { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
        @AuraEnabled public String status { get; set; }
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
}