public with sharing class PayrollReportHandler {
    
    // Wrapper class to reduce parameter count
    public class TimesheetProcessingContext {
        public Map<String, Object> empData;
        public Map<Integer, Decimal> empSlots;
        public List<Date> slotStarts;
        public Decimal reimbursementMultiplier;
        
        public TimesheetProcessingContext(Map<String, Object> empData, Map<Integer, Decimal> empSlots, 
                                        List<Date> slotStarts, Decimal reimbursementMultiplier) {
            this.empData = empData;
            this.empSlots = empSlots;
            this.slotStarts = slotStarts;
            this.reimbursementMultiplier = reimbursementMultiplier;
        }
    }
    
    public class SlotAssignmentData {
        public wfrecon__Timesheet_Entry__c entry;
        public Decimal reg;
        public Decimal travel;
        public Decimal reimbursement;
        
        public SlotAssignmentData(wfrecon__Timesheet_Entry__c entry, Decimal reg, Decimal travel, Decimal reimbursement) {
            this.entry = entry;
            this.reg = reg;
            this.travel = travel;
            this.reimbursement = reimbursement;
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getPayrollData(Date startDate, Date endDate) {
        try {
            // Input validation
            if (startDate == null || endDate == null) {
                throw new AuraHandledException('Start date and end date are required');
            }
            
            if (startDate > endDate) {
                throw new AuraHandledException('Start date cannot be after end date');
            }

            // Get Reimbursement multiplier from Custom Label
            Decimal reimbursementMultiplier = getReimbursementMultiplier();

            // Query timesheets with contact and job fields using USER_MODE
            List<wfrecon__Timesheet__c> timesheets = queryTimesheets(startDate, endDate);

            // Build slot boundaries
            List<Date> slotStarts = buildSlotBoundaries(startDate, endDate);

            // Process timesheet data
            Map<String, Map<String, Object>> empMap = processTimesheetData(timesheets, slotStarts, reimbursementMultiplier);

            // --- ADD URL LOGIC ---
            // Collect all Employee IDs and Job Names first
            Set<String> empIds = new Set<String>();
            Set<String> allJobNames = new Set<String>();
            for (Map<String,Object> emp : empMap.values()) {
                String empId = (String)emp.get('Employee');
                if (!String.isBlank(empId)) empIds.add(empId);

                List<String> jobNames = (List<String>)emp.get('JobNameList');
                if (jobNames != null) allJobNames.addAll(jobNames);
            }

            // Query Contacts in bulk
            Map<String, Id> empIdToContactId = new Map<String, Id>();
            if (!empIds.isEmpty()) {
                for (Contact con : [SELECT Id, Gesto_employee_ID__c FROM Contact WHERE Gesto_employee_ID__c IN :empIds]) {
                    empIdToContactId.put(con.Gesto_employee_ID__c, con.Id);
                }
            }

            // Query Jobs in bulk
            Map<String, Id> jobNameToJobId = new Map<String, Id>();
            if (!allJobNames.isEmpty()) {
                for (wfrecon__Job__c job : [SELECT Id, wfrecon__Job_Name__c FROM wfrecon__Job__c WHERE wfrecon__Job_Name__c IN :allJobNames]) {
                    jobNameToJobId.put(job.wfrecon__Job_Name__c, job.Id);
                }
            }

            for (Map<String,Object> emp : empMap.values()) {
                try { 
                    String empId = (String)emp.get('Employee');
                    if (!String.isBlank(empId) && empIdToContactId.containsKey(empId)) {
                        emp.put('EmployeeIdURL', '/' + empIdToContactId.get(empId));
                    }

                    // Job URLs
                    List<String> jobNames = (List<String>)emp.get('JobNameList');
                    List<Map<String, String>> jobURLObjects = new List<Map<String, String>>();
                    if (jobNames != null) {
                        for (String jobName : jobNames) {
                            if (jobNameToJobId.containsKey(jobName)) {
                                jobURLObjects.add(new Map<String, String>{ 'name' => jobName, 'url' => '/' + jobNameToJobId.get(jobName) });
                            } else {
                                jobURLObjects.add(new Map<String, String>{ 'name' => jobName, 'url' => null });
                            }
                        }
                    }
                    emp.put('JobURLs', jobURLObjects);

                    // Build JobRows (per-job aggregated numbers) from JobDetails if available
                    List<Map<String, Object>> jobRows = new List<Map<String, Object>>();
                    Map<String, Map<String, Decimal>> jobDetails = (Map<String, Map<String, Decimal>>)emp.get('JobDetails');
                    if (jobURLObjects != null && !jobURLObjects.isEmpty()) {
                        for (Map<String, String> jobObj : jobURLObjects) {
                            String jName = jobObj.get('name');
                            String jUrl = jobObj.get('url');
                            Decimal reg = 0;
                            Decimal travel = 0;
                            Decimal premium = 0;
                            Decimal reimbursement = 0;
                            if (jobDetails != null && jobDetails.containsKey(jName)) {
                                Map<String, Decimal> jd = jobDetails.get(jName);
                                if (jd != null) {
                                    reg = jd.containsKey('reg') ? jd.get('reg') : 0;
                                    travel = jd.containsKey('travel') ? jd.get('travel') : 0;
                                    premium = jd.containsKey('premium') ? jd.get('premium') : 0;
                                    reimbursement = jd.containsKey('reimbursement') ? jd.get('reimbursement') : 0;
                                }
                            }
                            jobRows.add(new Map<String, Object>{ 'name' => jName, 'url' => jUrl, 'reg' => reg, 'travel' => travel, 'premium' => premium, 'reimbursement' => reimbursement });
                        }
                    } else if (jobDetails != null && !jobDetails.isEmpty()) {
                        for (String jName : jobDetails.keySet()) {
                            Map<String, Decimal> jd = jobDetails.get(jName);
                            Decimal reg = jd.containsKey('reg') ? jd.get('reg') : 0;
                            Decimal travel = jd.containsKey('travel') ? jd.get('travel') : 0;
                            Decimal premium = jd.containsKey('premium') ? jd.get('premium') : 0;
                            Decimal reimbursement = jd.containsKey('reimbursement') ? jd.get('reimbursement') : 0;
                            String jUrl = jobNameToJobId.containsKey(jName) ? '/' + jobNameToJobId.get(jName) : null;
                            jobRows.add(new Map<String, Object>{ 'name' => jName, 'url' => jUrl, 'reg' => reg, 'travel' => travel, 'premium' => premium, 'reimbursement' => reimbursement });
                        }
                    }
                    emp.put('JobRows', jobRows);

                } catch (Exception urlEx) {
                    System.debug('Error creating URLs / JobRows: ' + urlEx.getMessage());
                }
            }
            // --- END URL LOGIC ---

            // Return list
            List<Map<String,Object>> result = new List<Map<String,Object>>();
            for (Map<String,Object> emp : empMap.values()) {result.add(emp);}
            return result;
            
        } catch (QueryException qe) {
            System.debug(LoggingLevel.ERROR, 'Query Exception in getPayrollData: ' + qe.getMessage());
            throw new AuraHandledException('Database query failed: ' + qe.getMessage());
        } catch (AuraHandledException ahe) {
            System.debug(LoggingLevel.ERROR, 'Aura Exception in getPayrollData: ' + ahe.getMessage());
            throw ahe;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Unexpected Exception in getPayrollData: ' + e.getMessage() + ' at line ' + e.getLineNumber());
            throw new AuraHandledException('An unexpected error occurred while retrieving payroll data: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String exportPayrollCSV(Date startDate, Date endDate) {
        try {
            List<Map<String,Object>> payrollData = getPayrollData(startDate, endDate);
            return generateCSVContent(payrollData);
        } catch (AuraHandledException ahe) {
            System.debug(LoggingLevel.ERROR, 'Aura Exception in exportPayrollCSV: ' + ahe.getMessage());
            throw ahe;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Unexpected Exception in exportPayrollCSV: ' + e.getMessage() + ' at line ' + e.getLineNumber());
            throw new AuraHandledException('Failed to export CSV: ' + e.getMessage());
        }
    }

    public static Decimal getReimbursementMultiplier() {
        try {
            return Decimal.valueOf(Label.Amount_of_the_Reimbursement);
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to get reimbursement multiplier from custom label, using default: ' + e.getMessage());
            return 1; // Default fallback
        }
    }

    // ✅ Only this method has been updated to filter on Item_Clock_In_Time__c instead of wfrecon__Time_In__c
    public static List<wfrecon__Timesheet__c> queryTimesheets(Date startDate, Date endDate) {
        try {
            return [
                SELECT Id, Name,
                       wfrecon__Contact__r.LastName,
                       wfrecon__Contact__r.FirstName,
                       wfrecon__Contact__r.Title,
                       wfrecon__Contact__r.Gesto_employee_ID__c,
                       wfrecon__Job__r.wfrecon__Job_Name__c,
                       (SELECT Id, Name, Item_Clock_In_Time__c, Total_Per_Diem_Value__c, Total_Travel_Time_Value__c, 
                               wfrecon__Total_Clock_In_Time__c, Premium__c
                        FROM wfrecon__Timesheet_Entries__r
                        WHERE Item_Clock_In_Time__c >= :startDate
                          AND Item_Clock_In_Time__c <= :endDate)
                FROM wfrecon__Timesheet__c
                WHERE Id IN (
                    SELECT wfrecon__Timesheet__c 
                    FROM wfrecon__Timesheet_Entry__c 
                    WHERE Item_Clock_In_Time__c >= :startDate 
                      AND Item_Clock_In_Time__c <= :endDate
                )
                WITH USER_MODE
                ORDER BY wfrecon__Contact__r.LastName, wfrecon__Contact__r.FirstName
            ];
        } catch (QueryException qe) {
            System.debug(LoggingLevel.ERROR, 'Query Exception in queryTimesheets: ' + qe.getMessage());
            throw qe;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Unexpected Exception in queryTimesheets: ' + e.getMessage());
            throw e;
        }
    }

    // The rest of your code remains EXACTLY the same (no edits below)
    public static List<Date> buildSlotBoundaries(Date startDate, Date endDate) {
        try {
            List<Date> slotStarts = new List<Date>();
            Date current = startDate;
            while (current <= endDate) {
                slotStarts.add(current);
                current = current.addDays(7);
            }
            slotStarts.add(endDate.addDays(1));
            return slotStarts;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Exception in buildSlotBoundaries: ' + e.getMessage());
            throw new AuraHandledException('Failed to build date slots: ' + e.getMessage());
        }
    }

    public static Map<String, Map<String, Object>> processTimesheetData(
        List<wfrecon__Timesheet__c> timesheets, 
        List<Date> slotStarts, 
        Decimal reimbursementMultiplier
    ) {
        try {
            Map<String, Map<Integer, Decimal>> slotHours = new Map<String, Map<Integer, Decimal>>();
            Map<String, Map<String, Object>> empMap = new Map<String, Map<String, Object>>();

            for (wfrecon__Timesheet__c ts : timesheets) {
                try {
                    if (ts.wfrecon__Contact__r == null) {
                        continue;
                    }
                    String empId = ts.wfrecon__Contact__r.Gesto_employee_ID__c;
                    if (String.isBlank(empId)) {
                        continue;
                    }

                    // Initialize employee map if not exists
                    if (!empMap.containsKey(empId)) {
                        empMap.put(empId, initializeEmployeeMap(ts));
                    }

                    if (!slotHours.containsKey(empId)) {
                        slotHours.put(empId, new Map<Integer, Decimal>());
                    }

                    // Collect unique jobs per employee
                    addJobToEmployee(empMap.get(empId), ts);

                    // Process timesheet entries
                    TimesheetProcessingContext context = new TimesheetProcessingContext(
                        empMap.get(empId), slotHours.get(empId), slotStarts, reimbursementMultiplier
                    );
                    processTimesheetEntries(ts, context);

                } catch (Exception tsException) {
                    System.debug(LoggingLevel.WARN, 'Error processing timesheet ' + ts.Id + ': ' + tsException.getMessage());
                    continue; // Skip this timesheet and continue with others
                }
            }

            // Apply 40hr rule slot by slot
            applyOvertimeRules(slotHours, empMap);

            return empMap;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Exception in processTimesheetData: ' + e.getMessage());
            throw new AuraHandledException('Failed to process timesheet data: ' + e.getMessage());
        }
    }

    public static Map<String, Object> initializeEmployeeMap(wfrecon__Timesheet__c ts) {
        try {
            return new Map<String,Object>{
                'last_name' => ts.wfrecon__Contact__r.LastName,
                'first_name' => ts.wfrecon__Contact__r.FirstName,
                'title' => ts.wfrecon__Contact__r.Title,
                'Employee' => ts.wfrecon__Contact__r.Gesto_employee_ID__c,
                'regular_hours' => 0,
                'overtime_hours' => 0,
                'reimbursement' => 0,
                'premium_hours' => 0,
                'double_overtime_hours' => 0,
                'bonus' => 0,
                'commission' => 0,
                'paycheck_tips' => 0,
                'cash_tips' => 0,
                'correction_payment' => 0,
                'personal_note' => '',
                'TravelPay' => 0,
                'VacationPay' => 0,
                'Holiday' => 0,
                'JobNameList' => new List<String>(),
                'TravelHoursDisplay' => 0,
                // JobDetails holds per-job aggregated values { jobName => { 'reg' => Decimal, 'travel' => Decimal, 'premium' => Decimal, 'reimbursement' => Decimal } }
                'JobDetails' => new Map<String, Map<String, Decimal>>()
            };
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Exception in initializeEmployeeMap: ' + e.getMessage());
            throw e;
        }
    }

    public static void addJobToEmployee(Map<String, Object> empData, wfrecon__Timesheet__c ts) {
        try {
            if (ts.wfrecon__Job__r != null && ts.wfrecon__Job__r.wfrecon__Job_Name__c != null) {
                List<String> jobs = (List<String>)empData.get('JobNameList');
                String jobName = ts.wfrecon__Job__r.wfrecon__Job_Name__c;
                if (!jobs.contains(jobName)) {
                    jobs.add(jobName);
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Exception in addJobToEmployee: ' + e.getMessage());
        }
    }

    public static void processTimesheetEntries(wfrecon__Timesheet__c ts, TimesheetProcessingContext context) {
        try {
            // jobName for this timesheet (entries belong to the same timesheet's job)
            String timesheetJobName = (ts.wfrecon__Job__r != null) ? ts.wfrecon__Job__r.wfrecon__Job_Name__c : 'Unknown';

            for (wfrecon__Timesheet_Entry__c entry : ts.wfrecon__Timesheet_Entries__r) {
                try {
                    Decimal reg = entry.wfrecon__Total_Clock_In_Time__c == null ? 0 : entry.wfrecon__Total_Clock_In_Time__c;
                    Decimal travel = entry.Total_Travel_Time_Value__c == null ? 0 : entry.Total_Travel_Time_Value__c;
                    Decimal reimbursement = entry.Total_Per_Diem_Value__c == null ? 0 : entry.Total_Per_Diem_Value__c;

                    // Apply custom label multiplier to reimbursement
                    reimbursement = reimbursement * (context.reimbursementMultiplier == null ? 1 : context.reimbursementMultiplier);

                    // Assign to slot (this accumulates empSlots and empData TravelPay/reimbursement)
                    SlotAssignmentData slotData = new SlotAssignmentData(entry, reg, travel, reimbursement);
                    assignToSlot(slotData, context);

                    // Add premium hours: use actual clocked hours (reg)
                    if (entry.Premium__c == true) {
                        Decimal totalPremiumHours = reg + travel; // add travel hours also
                        context.empData.put('premium_hours', (Decimal)context.empData.get('premium_hours') + totalPremiumHours);
                    }
                    //NEW: accumulate travel hours for UI display
                    context.empData.put('TravelHoursDisplay', (Decimal)context.empData.get('TravelHoursDisplay') + travel);

                    // ---- NEW: aggregate per-job values into JobDetails map ----
                    try {
                        Map<String, Map<String, Decimal>> jobDetails = (Map<String, Map<String, Decimal>>)context.empData.get('JobDetails');
                        if (jobDetails == null) {
                            jobDetails = new Map<String, Map<String, Decimal>>();
                            context.empData.put('JobDetails', jobDetails);
                        }
                        if (!jobDetails.containsKey(timesheetJobName)) {
                            jobDetails.put(timesheetJobName, new Map<String, Decimal>{ 'reg' => 0, 'travel' => 0, 'premium' => 0, 'reimbursement' => 0 });
                        }
                        Map<String, Decimal> jd = jobDetails.get(timesheetJobName);
                        jd.put('reg', jd.get('reg') + reg);
                        jd.put('travel', jd.get('travel') + travel);
                        jd.put('reimbursement', jd.get('reimbursement') + reimbursement);
                        // premium recorded as hours only if Premium__c true
                        if (entry.Premium__c == true) {
                            jd.put('premium', jd.get('premium') + (reg + travel));
                        }
                    } catch (Exception jobAggEx) {
                        System.debug(LoggingLevel.WARN, 'Failed to aggregate job-level values: ' + jobAggEx.getMessage());
                    }
                    // ---- END per-job aggregation ----

                } catch (Exception entryException) {
                    System.debug(LoggingLevel.WARN, 'Error processing timesheet entry ' + entry.Id + ': ' + entryException.getMessage());
                    continue;
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Exception in processTimesheetEntries: ' + e.getMessage());
            throw e;
        }
    }

    public static void assignToSlot(SlotAssignmentData slotData, TimesheetProcessingContext context) {
        try {
            for (Integer i = 0; i < context.slotStarts.size() - 1; i++) {
                Date slotStart = context.slotStarts[i];
                Date slotEnd = context.slotStarts[i+1].addDays(-1);

                Date itemDate = Date.valueOf(slotData.entry.Item_Clock_In_Time__c.dateGMT());
                if (itemDate >= slotStart && itemDate <= slotEnd) {
                    context.empSlots.put(i, (context.empSlots.containsKey(i) ? context.empSlots.get(i) : 0) + slotData.reg);

                    // Accumulate side pays
                    context.empData.put('TravelPay', (Decimal)context.empData.get('TravelPay') + slotData.travel);
                    context.empData.put('reimbursement', (Decimal)context.empData.get('reimbursement') + slotData.reimbursement);
                    break;
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Exception in assignToSlot: ' + e.getMessage());
        }
    }

    public static void applyOvertimeRules(Map<String, Map<Integer, Decimal>> slotHours, Map<String, Map<String, Object>> empMap) {
        try {
            for (String empId : slotHours.keySet()) {
                try {
                    Map<String,Object> emp = empMap.get(empId);
                    for (Decimal hours : slotHours.get(empId).values()) {
                        if (hours > 40) {
                            emp.put('regular_hours', (Decimal)emp.get('regular_hours') + 40);
                            emp.put('overtime_hours', (Decimal)emp.get('overtime_hours') + (hours - 40));
                        } else {
                            emp.put('regular_hours', (Decimal)emp.get('regular_hours') + hours);
                        }
                    }

                    // Add travel to regular_hours
                    Decimal regWithTravel = (Decimal)emp.get('regular_hours') + (Decimal)emp.get('TravelPay');
                    emp.put('regular_hours', regWithTravel);
                    // emp.put('regularHoursDisplay', (Decimal)emp.get('regular_hours'));
                } catch (Exception empException) {
                    System.debug(LoggingLevel.WARN, 'Error applying overtime rules for employee ' + empId + ': ' + empException.getMessage());
                    continue;
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Exception in applyOvertimeRules: ' + e.getMessage());
            throw e;
        }
    }

    public static String generateCSVContent(List<Map<String,Object>> payrollData) {
        try {
            List<String> headers = new List<String>{
                'last_name','first_name','title','Employee','regular_hours',
                'overtime_hours','reimbursement','premium_hours','double_overtime_hours','bonus',
                'commission','paycheck_tips','cash_tips','correction_payment','personal_note'
            };

            String csv = String.join(headers, ',') + '\n';

            for (Map<String,Object> row : payrollData) {
                try {
                    List<String> line = new List<String>();
                    for (String h : headers) {
                        Object val = row.containsKey(h) ? row.get(h) : '';
                        line.add(val == null ? '' : String.valueOf(val));
                    }
                    csv += String.join(line, ',') + '\n';
                } catch (Exception rowException) {
                    System.debug(LoggingLevel.WARN, 'Error processing CSV row: ' + rowException.getMessage());
                    continue;
                }
            }
            return csv;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Exception in generateCSVContent: ' + e.getMessage());
            throw new AuraHandledException('Failed to generate CSV content: ' + e.getMessage());
        }
    }
    
    
}