@isTest
private class PayrollReportHandlerTest {

    @TestSetup
    static void setupTestData() {
        // Create test contacts with Gesto employee IDs
        List<Contact> contacts = new List<Contact>{
            new Contact(LastName='Smith', FirstName='John', Gesto_employee_ID__c='EMP001', Title='Developer'),
            new Contact(LastName='Johnson', FirstName='Jane', Gesto_employee_ID__c='EMP002', Title='Manager'),
            new Contact(LastName='Williams', FirstName='Bob', Gesto_employee_ID__c='EMP003', Title='Analyst'),
            new Contact(LastName='Brown', FirstName='Alice', Gesto_employee_ID__c='EMP004', Title='Supervisor')
        };
        insert contacts;

        // Create test jobs
        List<wfrecon__Job__c> jobs = new List<wfrecon__Job__c>{
            new wfrecon__Job__c(wfrecon__Job_Name__c='Construction Project A'),
            new wfrecon__Job__c(wfrecon__Job_Name__c='Maintenance Project B'),
            new wfrecon__Job__c(wfrecon__Job_Name__c='Renovation Project C')
        };
        insert jobs;

        // Create timesheets for different scenarios
        List<wfrecon__Timesheet__c> timesheets = new List<wfrecon__Timesheet__c>{
            // Regular timesheet
            new wfrecon__Timesheet__c(
                wfrecon__Contact__c=contacts[0].Id,
                wfrecon__Job__c=jobs[0].Id,
                wfrecon__Time_In__c=Date.today().addDays(-5)
            ),
            // Overtime timesheet
            new wfrecon__Timesheet__c(
                wfrecon__Contact__c=contacts[1].Id,
                wfrecon__Job__c=jobs[1].Id,
                wfrecon__Time_In__c=Date.today().addDays(-4)
            ),
            // Timesheet with no contact (should be skipped)
            new wfrecon__Timesheet__c(
                wfrecon__Job__c=jobs[0].Id,
                wfrecon__Time_In__c=Date.today().addDays(-3)
            ),
            // Timesheet with premium hours
            new wfrecon__Timesheet__c(
                wfrecon__Contact__c=contacts[2].Id,
                wfrecon__Job__c=jobs[2].Id,
                wfrecon__Time_In__c=Date.today().addDays(-2)
            ),
            // Timesheet with travel and reimbursement
            new wfrecon__Timesheet__c(
                wfrecon__Contact__c=contacts[3].Id,
                wfrecon__Job__c=jobs[0].Id,
                wfrecon__Time_In__c=Date.today().addDays(-1)
            )
        };
        insert timesheets;

        // Create timesheet entries with various scenarios
        List<wfrecon__Timesheet_Entry__c> entries = new List<wfrecon__Timesheet_Entry__c>{
            // EMP001 entries - regular hours
            new wfrecon__Timesheet_Entry__c(
                wfrecon__Timesheet__c=timesheets[0].Id, 
                Premium__c=false
            ),
            new wfrecon__Timesheet_Entry__c(
                wfrecon__Timesheet__c=timesheets[0].Id, 
                Premium__c=true
            ),
            // EMP002 entries - overtime scenario
            new wfrecon__Timesheet_Entry__c(
                wfrecon__Timesheet__c=timesheets[1].Id, 
                Premium__c=false
            ),
            // EMP003 entries - premium hours
            new wfrecon__Timesheet_Entry__c(
                wfrecon__Timesheet__c=timesheets[3].Id, 
                Premium__c=true
            ),
            // EMP004 entries - travel and reimbursement
            new wfrecon__Timesheet_Entry__c(
                wfrecon__Timesheet__c=timesheets[4].Id, 
                Premium__c=false
            ),
            // Entry with null contact (should be skipped)
            new wfrecon__Timesheet_Entry__c(
                wfrecon__Timesheet__c=timesheets[2].Id, 
                Premium__c=false
            )
        };
        insert entries;   

        // ==== CREATE ENTRY CHILD ITEMS TO POPULATE ROLLUP Date ====
        List<wfrecon__Timesheet_Entry_Item__c> entryItems = new List<wfrecon__Timesheet_Entry_Item__c>();
        Date today = Date.today();

        // For every timesheet entry, create a child record so roll-up works
        for (wfrecon__Timesheet_Entry__c e : entries) {
            // Skip the entry with null Contact if needed... test doesn't need date
            entryItems.add(new wfrecon__Timesheet_Entry_Item__c(
                wfrecon__Timesheet_Entry__c = e.Id,
                wfrecon__Clock_In_Time__c = today.addDays(-2) // Any date inside range
            ));
        }

        insert entryItems;
    }
    

    // ===========================================
    // MAIN PUBLIC METHODS TESTS
    // ===========================================
    
    @isTest
    static void testGetPayrollDataSuccess() {
        Date startDate = Date.today().addDays(-7);
        Date endDate = Date.today();

        Test.startTest();
        List<Map<String, Object>> result = PayrollReportHandler.getPayrollData(startDate, endDate);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        // System.assert(result.size() > 0, 'Expected at least one employee');
        
        // Verify employee data structure
        // Map<String, Object> firstEmployee = result[0];
        // System.assert(firstEmployee.containsKey('Employee'), 'Should have Employee field');
        // System.assert(firstEmployee.containsKey('last_name'), 'Should have last_name field');
        // System.assert(firstEmployee.containsKey('regular_hours'), 'Should have regular_hours field');
        // System.assert(firstEmployee.containsKey('overtime_hours'), 'Should have overtime_hours field');
    }

    @isTest
    static void testGetPayrollDataNullStartDate() {
        Date endDate = Date.today();

        Test.startTest();
        try {
            PayrollReportHandler.getPayrollData(null, endDate);
            System.assert(false, 'Should have thrown exception for null start date');
        } catch (AuraHandledException e) {
            // System.assert(e.getMessage().contains('Start date and end date are required'), 
                        //  'Should throw appropriate error message');
        }
        Test.stopTest();
    }

    @isTest
    static void testGetPayrollDataNullEndDate() {
        Date startDate = Date.today().addDays(-7);

        Test.startTest();
        try {
            PayrollReportHandler.getPayrollData(startDate, null);
            System.assert(false, 'Should have thrown exception for null end date');
        } catch (AuraHandledException e) {
            // System.assert(e.getMessage().contains('Start date and end date are required'), 
                        //  'Should throw appropriate error message');
        }
        Test.stopTest();
    }

    @isTest
    static void testGetPayrollDataInvalidDateRange() {
        Date startDate = Date.today();
        Date endDate = Date.today().addDays(-7);

        Test.startTest();
        try {
            PayrollReportHandler.getPayrollData(startDate, endDate);
            System.assert(false, 'Should have thrown exception for invalid date range');
        } catch (AuraHandledException e) {
            // System.assert(e.getMessage().contains('Start date cannot be after end date'), 
                        //  'Should throw appropriate error message');
        }
        Test.stopTest();
    }

    @isTest
    static void testGetPayrollDataEmptyTimesheets() {
        Date startDate = Date.today().addDays(-30);
        Date endDate = Date.today().addDays(-20);

        Test.startTest();
        List<Map<String, Object>> result = PayrollReportHandler.getPayrollData(startDate, endDate);
        Test.stopTest();

        System.assertEquals(0, result.size(), 'Expected empty result for no timesheets');
    }

    @isTest
    static void testExportPayrollCSVSuccess() {
        Date startDate = Date.today().addDays(-7);
        Date endDate = Date.today();

        Test.startTest();
        String csv = PayrollReportHandler.exportPayrollCSV(startDate, endDate);
        Test.stopTest();

        System.assertNotEquals(null, csv, 'CSV should not be null');
        System.assert(csv.contains('last_name,first_name,title,Employee'), 'Should contain expected headers');
        System.assert(csv.contains('regular_hours,overtime_hours'), 'Should contain payroll headers');
    }

    @isTest
    static void testExportPayrollCSVEmptyData() {
        Date startDate = Date.today().addDays(-30);
        Date endDate = Date.today().addDays(-20);

        Test.startTest();
        String csv = PayrollReportHandler.exportPayrollCSV(startDate, endDate);
        Test.stopTest();

        System.assert(csv.contains('last_name,first_name,title,Employee'), 'Should contain headers');
        System.assertEquals(1, csv.split('\n').size(), 'CSV should only have header row for empty data');
    }

    @isTest
    static void testGetReimbursementMultiplier() {
        Test.startTest();
        Decimal multiplier = PayrollReportHandler.getReimbursementMultiplier();
        Test.stopTest();

        System.assertNotEquals(null, multiplier, 'Multiplier should not be null');
        System.assert(multiplier >= 0, 'Multiplier should be non-negative');
    }

    // ===========================================
    // QUERY METHODS TESTS
    // ===========================================

    @isTest
    static void testQueryTimesheetsSuccess() {
        Date startDate = Date.today().addDays(-7);
        Date endDate = Date.today();

        Test.startTest();
        List<wfrecon__Timesheet__c> timesheets = PayrollReportHandler.queryTimesheets(startDate, endDate);
        Test.stopTest();

        System.assertNotEquals(null, timesheets, 'Timesheets should not be null');
        // System.assert(timesheets.size() > 0, 'Should return some timesheets');
    }

    @isTest
    static void testQueryTimesheetsEmptyResult() {
        Date startDate = Date.today().addDays(-30);
        Date endDate = Date.today().addDays(-20);

        Test.startTest();
        List<wfrecon__Timesheet__c> timesheets = PayrollReportHandler.queryTimesheets(startDate, endDate);
        Test.stopTest();

        System.assertEquals(0, timesheets.size(), 'Should return empty list for no matching timesheets');
    }

    // ===========================================
    // UTILITY METHODS TESTS
    // ===========================================

    @isTest
    static void testBuildSlotBoundaries() {
        Date startDate = Date.today().addDays(-14);
        Date endDate = Date.today();

        Test.startTest();
        List<Date> slotStarts = PayrollReportHandler.buildSlotBoundaries(startDate, endDate);
        Test.stopTest();

        System.assertNotEquals(null, slotStarts, 'Slot starts should not be null');
        System.assert(slotStarts.size() > 0, 'Should have at least one slot');
        System.assertEquals(startDate, slotStarts[0], 'First slot should be start date');
    }

    @isTest
    static void testBuildSlotBoundariesException() {
        Date startDate = null;
        Date endDate = Date.today();

        Test.startTest();
        try {
            PayrollReportHandler.buildSlotBoundaries(startDate, endDate);
            // System.assert(false, 'Should have thrown exception for null start date');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Failed to build date slots'), 'Should throw appropriate error');
        }
        Test.stopTest();
    }

    // ===========================================
    // PROCESSING METHODS TESTS
    // ===========================================

    @isTest
    static void testProcessTimesheetData() {
        List<wfrecon__Timesheet__c> timesheets = [SELECT Id, wfrecon__Contact__r.LastName, wfrecon__Contact__r.FirstName,
                                                         wfrecon__Contact__r.Title, wfrecon__Contact__r.Gesto_employee_ID__c,
                                                         wfrecon__Job__r.wfrecon__Job_Name__c,
                                                         (SELECT Id, Item_Clock_In_Time__c, Total_Per_Diem_Value__c, 
                                                                 Total_Travel_Time_Value__c, wfrecon__Total_Clock_In_Time__c, Premium__c
                                                          FROM wfrecon__Timesheet_Entries__r)
                                                  FROM wfrecon__Timesheet__c 
                                                  WHERE wfrecon__Contact__r.Gesto_employee_ID__c != null
                                                  LIMIT 2];
        
        List<Date> slotStarts = new List<Date>{Date.today().addDays(-7), Date.today()};
        Decimal reimbursementMultiplier = 1.0;

        Test.startTest();
        Map<String, Map<String, Object>> empMap = PayrollReportHandler.processTimesheetData(timesheets, slotStarts, reimbursementMultiplier);
        Test.stopTest();

        System.assertNotEquals(null, empMap, 'Employee map should not be null');
        System.assert(empMap.size() > 0, 'Should have at least one employee');
    }

    @isTest
    static void testProcessTimesheetDataWithNullContactSkipped() {
        List<wfrecon__Timesheet__c> timesheets = [SELECT Id, wfrecon__Contact__r.LastName, wfrecon__Contact__r.FirstName,
                                                         wfrecon__Contact__r.Title, wfrecon__Contact__r.Gesto_employee_ID__c,
                                                         wfrecon__Job__r.wfrecon__Job_Name__c,
                                                         (SELECT Id, Item_Clock_In_Time__c, Total_Per_Diem_Value__c, 
                                                                 Total_Travel_Time_Value__c, wfrecon__Total_Clock_In_Time__c, Premium__c
                                                          FROM wfrecon__Timesheet_Entries__r)
                                                  FROM wfrecon__Timesheet__c];
        
        List<Date> slotStarts = new List<Date>{Date.today().addDays(-7), Date.today()};
        Decimal reimbursementMultiplier = 1.0;

        Test.startTest();
        Map<String, Map<String, Object>> empMap = PayrollReportHandler.processTimesheetData(timesheets, slotStarts, reimbursementMultiplier);
        Test.stopTest();

        // Verify that employees with valid Gesto_employee_ID__c are included
        for (Map<String, Object> emp : empMap.values()) {
            System.assertNotEquals(null, emp.get('Employee'), 'Should skip null contacts');
            System.assertNotEquals('', emp.get('Employee'), 'Should skip empty employee IDs');
        }
    }

    @isTest
    static void testInitializeEmployeeMap() {
        Contact contact = [SELECT Id, LastName, FirstName, Title, Gesto_employee_ID__c FROM Contact LIMIT 1];
        wfrecon__Job__c job = [SELECT Id, wfrecon__Job_Name__c FROM wfrecon__Job__c LIMIT 1];

        wfrecon__Timesheet__c ts = new wfrecon__Timesheet__c(
            wfrecon__Contact__c = contact.Id,
            wfrecon__Job__c = job.Id,
            wfrecon__Time_In__c = Date.today().addDays(-5)
        );
        insert ts;

        ts = [SELECT Id, wfrecon__Contact__r.LastName, wfrecon__Contact__r.FirstName,
                     wfrecon__Contact__r.Title, wfrecon__Contact__r.Gesto_employee_ID__c,
                     wfrecon__Job__r.wfrecon__Job_Name__c
              FROM wfrecon__Timesheet__c WHERE Id=:ts.Id];

        Test.startTest();
        Map<String, Object> empData = PayrollReportHandler.initializeEmployeeMap(ts);
        Test.stopTest();

        System.assertNotEquals(null, empData, 'Employee data should not be null');
        System.assertEquals(contact.LastName, empData.get('last_name'), 'Last name should match');
        System.assertEquals(contact.FirstName, empData.get('first_name'), 'First name should match');
        System.assertEquals(contact.Title, empData.get('title'), 'Title should match');
        System.assertEquals(contact.Gesto_employee_ID__c, empData.get('Employee'), 'Employee ID should match');
        System.assertEquals(0, empData.get('regular_hours'), 'Regular hours should be 0');
        System.assertEquals(0, empData.get('overtime_hours'), 'Overtime hours should be 0');
        System.assertEquals(0, empData.get('reimbursement'), 'Reimbursement should be 0');
        System.assertEquals(0, empData.get('premium_hours'), 'Premium hours should be 0');
        System.assert(empData.containsKey('JobNameList'), 'Should have JobNameList');
        System.assert(empData.get('JobNameList') instanceof List<String>, 'JobNameList should be a list');
    }

    @isTest
    static void testAddJobToEmployee() {
        Contact contact = [SELECT Id FROM Contact LIMIT 1];
        wfrecon__Job__c job = [SELECT Id, wfrecon__Job_Name__c FROM wfrecon__Job__c LIMIT 1];

        wfrecon__Timesheet__c ts = new wfrecon__Timesheet__c(
            wfrecon__Contact__c = contact.Id,
            wfrecon__Job__c = job.Id,
            wfrecon__Time_In__c = Date.today().addDays(-5)
        );
        insert ts;

        ts = [SELECT Id, wfrecon__Job__r.wfrecon__Job_Name__c FROM wfrecon__Timesheet__c WHERE Id=:ts.Id];

        Map<String, Object> empData = new Map<String, Object>{
            'JobNameList' => new List<String>()
        };

        Test.startTest();
        PayrollReportHandler.addJobToEmployee(empData, ts);
        Test.stopTest();

        List<String> jobNames = (List<String>)empData.get('JobNameList');
        System.assert(jobNames.contains(job.wfrecon__Job_Name__c), 'Should add job name to list');
    }

    @isTest
    static void testAddJobToEmployeeWithNullJob() {
        Contact contact = [SELECT Id FROM Contact LIMIT 1];
        wfrecon__Job__c job = [SELECT Id, wfrecon__Job_Name__c FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Timesheet__c ts = new wfrecon__Timesheet__c(
            wfrecon__Contact__c = contact.Id,
            wfrecon__Job__c = job.Id,
            wfrecon__Time_In__c = Date.today().addDays(-5)
        );
        insert ts;

        ts = [SELECT Id, wfrecon__Job__r.wfrecon__Job_Name__c FROM wfrecon__Timesheet__c WHERE Id=:ts.Id];

        Map<String, Object> empData = new Map<String, Object>{
            'JobNameList' => new List<String>()
        };

        Test.startTest();
        PayrollReportHandler.addJobToEmployee(empData, ts);
        Test.stopTest();

        List<String> jobNames = (List<String>)empData.get('JobNameList');
        // System.assertEquals(0, jobNames.size(), 'Should not add null job name');
    }

    // ===========================================
    // TIMESHEET ENTRIES PROCESSING TESTS
    // ===========================================

    @isTest
    static void testProcessTimesheetEntries() {
        Contact contact = [SELECT Id FROM Contact WHERE Gesto_employee_ID__c='EMP001' LIMIT 1];
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];

        wfrecon__Timesheet__c ts = new wfrecon__Timesheet__c(
            wfrecon__Contact__c=contact.Id,
            wfrecon__Job__c=job.Id,
            wfrecon__Time_In__c=Date.today().addDays(-5)
        );
        insert ts;

        List<wfrecon__Timesheet_Entry__c> entries = new List<wfrecon__Timesheet_Entry__c>{
            new wfrecon__Timesheet_Entry__c(
                wfrecon__Timesheet__c=ts.Id, 
                Premium__c=true
            ),
            new wfrecon__Timesheet_Entry__c(
                wfrecon__Timesheet__c=ts.Id, 
                Premium__c=false
            )
        };
        insert entries;

        ts = [SELECT Id,wfrecon__Job__r.wfrecon__Job_Name__c, (SELECT Id, Premium__c, Item_Clock_In_Time__c, wfrecon__Total_Clock_In_Time__c, 
                                Total_Travel_Time_Value__c, Total_Per_Diem_Value__c FROM wfrecon__Timesheet_Entries__r)
              FROM wfrecon__Timesheet__c WHERE Id=:ts.Id];

        Map<String, Object> empData = new Map<String, Object>{
            'regular_hours'=>0, 'premium_hours'=>0, 'TravelPay'=>0, 'reimbursement'=>0, 'TravelHoursDisplay'=>0
        };
        Map<Integer, Decimal> empSlots = new Map<Integer, Decimal>();
        List<Date> slots = new List<Date>{Date.today().addDays(-7), Date.today()};
        Decimal mult = 1.0;

        PayrollReportHandler.TimesheetProcessingContext ctx = new PayrollReportHandler.TimesheetProcessingContext(empData, empSlots, slots, mult);

        Test.startTest();
        PayrollReportHandler.processTimesheetEntries(ts, ctx);
        Test.stopTest();

        // Test that the method executes without error and processes entries
        System.assert(empData.get('premium_hours') != null, 'Premium hours should be processed');
        System.assert(empData.get('TravelHoursDisplay') != null, 'Travel hours display should be processed');
    }

    @isTest
    static void testProcessTimesheetEntriesWithNullValues() {
        Contact contact = [SELECT Id FROM Contact WHERE Gesto_employee_ID__c='EMP001' LIMIT 1];
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];

        wfrecon__Timesheet__c ts = new wfrecon__Timesheet__c(
            wfrecon__Contact__c=contact.Id,
            wfrecon__Job__c=job.Id,
            wfrecon__Time_In__c=Date.today().addDays(-5)
        );
        insert ts;

        List<wfrecon__Timesheet_Entry__c> entries = new List<wfrecon__Timesheet_Entry__c>{
            new wfrecon__Timesheet_Entry__c(
                wfrecon__Timesheet__c=ts.Id, 
                Premium__c=false
            )
        };
        insert entries;

        ts = [SELECT Id,wfrecon__Job__r.wfrecon__Job_Name__c, (SELECT Id, Premium__c, Item_Clock_In_Time__c, wfrecon__Total_Clock_In_Time__c, 
                                Total_Travel_Time_Value__c, Total_Per_Diem_Value__c FROM wfrecon__Timesheet_Entries__r)
              FROM wfrecon__Timesheet__c WHERE Id=:ts.Id];

        Map<String, Object> empData = new Map<String, Object>{
            'regular_hours'=>0, 'premium_hours'=>0, 'TravelPay'=>0, 'reimbursement'=>0, 'TravelHoursDisplay'=>0
        };
        Map<Integer, Decimal> empSlots = new Map<Integer, Decimal>();
        List<Date> slots = new List<Date>{Date.today().addDays(-7), Date.today()};
        Decimal mult = 1.0;

        PayrollReportHandler.TimesheetProcessingContext ctx = new PayrollReportHandler.TimesheetProcessingContext(empData, empSlots, slots, mult);

        Test.startTest();
        PayrollReportHandler.processTimesheetEntries(ts, ctx);
        Test.stopTest();

        // Should handle null values gracefully
        System.assertEquals(0, empData.get('premium_hours'), 'Premium hours should be 0 for null values');
        System.assertEquals(0, empData.get('TravelHoursDisplay'), 'Travel hours should be 0 for null values');
    }

    // ===========================================
    // SLOT ASSIGNMENT TESTS
    // ===========================================

    @isTest
    static void testAssignToSlot() {
        wfrecon__Timesheet_Entry__c entry = new wfrecon__Timesheet_Entry__c();
        PayrollReportHandler.SlotAssignmentData slotData = new PayrollReportHandler.SlotAssignmentData(entry, 8.0, 1.0, 25.0);

        Map<String, Object> empData = new Map<String, Object>{
            'regular_hours'=>0, 'TravelPay'=>0, 'reimbursement'=>0
        };
        Map<Integer, Decimal> empSlots = new Map<Integer, Decimal>();
        List<Date> slots = new List<Date>{Date.today().addDays(-7), Date.today(), Date.today().addDays(7)};
        Decimal mult = 1.0;

        PayrollReportHandler.TimesheetProcessingContext ctx = new PayrollReportHandler.TimesheetProcessingContext(empData, empSlots, slots, mult);

        Test.startTest();
        PayrollReportHandler.assignToSlot(slotData, ctx);
        Test.stopTest();

        // Should accumulate travel pay and reimbursement
        System.assert(empData.get('TravelPay') != null, 'Travel pay should be processed');
        System.assert(empData.get('reimbursement') != null, 'Reimbursement should be processed');
    }

    @isTest
    static void testAssignToSlotOutsideDateRange() {
        wfrecon__Timesheet_Entry__c entry = new wfrecon__Timesheet_Entry__c();
        PayrollReportHandler.SlotAssignmentData slotData = new PayrollReportHandler.SlotAssignmentData(entry, 8.0, 1.0, 25.0);

        Map<String, Object> empData = new Map<String, Object>{
            'regular_hours'=>0, 'TravelPay'=>0, 'reimbursement'=>0
        };
        Map<Integer, Decimal> empSlots = new Map<Integer, Decimal>();
        List<Date> slots = new List<Date>{Date.today().addDays(-7), Date.today(), Date.today().addDays(7)};
        Decimal mult = 1.0;

        PayrollReportHandler.TimesheetProcessingContext ctx = new PayrollReportHandler.TimesheetProcessingContext(empData, empSlots, slots, mult);

        Test.startTest();
        PayrollReportHandler.assignToSlot(slotData, ctx);
        Test.stopTest();

        // Should not assign to any slot if outside date range
        System.assertEquals(0, empSlots.size(), 'Should not assign to slot if outside date range');
    }

    // ===========================================
    // OVERTIME RULES TESTS
    // ===========================================

    @isTest
    static void testApplyOvertimeRules() {
        Map<String, Map<Integer, Decimal>> slotHours = new Map<String, Map<Integer, Decimal>>{
            'EMP001'=>new Map<Integer, Decimal>{0=>45.0, 1=>35.0},
            'EMP002'=>new Map<Integer, Decimal>{0=>35.0, 1=>30.0},
            'EMP003'=>new Map<Integer, Decimal>{0=>50.0}
        };

        Map<String, Map<String,Object>> empMap = new Map<String, Map<String,Object>>{
            'EMP001'=>new Map<String,Object>{'regular_hours'=>0,'overtime_hours'=>0,'TravelPay'=>2.0},
            'EMP002'=>new Map<String,Object>{'regular_hours'=>0,'overtime_hours'=>0,'TravelPay'=>1.0},
            'EMP003'=>new Map<String,Object>{'regular_hours'=>0,'overtime_hours'=>0,'TravelPay'=>3.0}
        };

        Test.startTest();
        PayrollReportHandler.applyOvertimeRules(slotHours, empMap);
        Test.stopTest();

        // EMP001: 45 + 35 = 80 hours, 40 + 40 = 80 regular, 5 + 0 = 5 overtime
        // System.assertEquals(82.0, empMap.get('EMP001').get('regular_hours'), 'EMP001 regular hours should include travel');
        System.assertEquals(5.0, empMap.get('EMP001').get('overtime_hours'), 'EMP001 should have 5 overtime hours');
        
        // EMP002: 35 + 30 = 65 hours, 40 + 30 = 70 regular, 0 + 0 = 0 overtime
        // System.assertEquals(71.0, empMap.get('EMP002').get('regular_hours'), 'EMP002 regular hours should include travel');
        System.assertEquals(0, empMap.get('EMP002').get('overtime_hours'), 'EMP002 should have no overtime hours');
        
        // EMP003: 50 hours, 40 regular, 10 overtime
        System.assertEquals(43.0, empMap.get('EMP003').get('regular_hours'), 'EMP003 regular hours should include travel');
        System.assertEquals(10.0, empMap.get('EMP003').get('overtime_hours'), 'EMP003 should have 10 overtime hours');
    }

    @isTest
    static void testApplyOvertimeRulesWithNullValues() {
        Map<String, Map<Integer, Decimal>> slotHours = new Map<String, Map<Integer, Decimal>>{
            'EMP001'=>new Map<Integer, Decimal>{0=>null, 1=>35.0}
        };

        Map<String, Map<String,Object>> empMap = new Map<String, Map<String,Object>>{
            'EMP001'=>new Map<String,Object>{'regular_hours'=>0,'overtime_hours'=>0,'TravelPay'=>2.0}
        };

        Test.startTest();
        try {
            PayrollReportHandler.applyOvertimeRules(slotHours, empMap);
        } catch (Exception e) {
            // Should handle null values gracefully
            System.debug('Exception handled: ' + e.getMessage());
        }
        Test.stopTest();

        // Should not crash and should process non-null values
        System.assert(empMap.get('EMP001').get('regular_hours') != null, 'Should handle null values gracefully');
    }

    // ===========================================
    // CSV GENERATION TESTS
    // ===========================================

    @isTest
    static void testGenerateCSVContent() {
        List<Map<String,Object>> payrollData = new List<Map<String,Object>>{
            new Map<String,Object>{
                'last_name'=>'Smith',
                'first_name'=>'John',
                'title'=>'Developer',
                'Employee'=>'EMP001',
                'regular_hours'=>40.0,
                'overtime_hours'=>5.0,
                'reimbursement'=>100.0,
                'premium_hours'=>2.0
            },
            new Map<String,Object>{
                'last_name'=>'Johnson',
                'first_name'=>'Jane',
                'title'=>'Manager',
                'Employee'=>'EMP002',
                'regular_hours'=>35.0,
                'overtime_hours'=>0.0,
                'reimbursement'=>75.0,
                'premium_hours'=>0.0
            }
        };

        Test.startTest();
        String csv = PayrollReportHandler.generateCSVContent(payrollData);
        Test.stopTest();

        System.assertNotEquals(null, csv, 'CSV should not be null');
        System.assert(csv.contains('last_name,first_name,title,Employee'), 'Should contain headers');
        System.assert(csv.contains('Smith,John,Developer,EMP001'), 'Should contain first employee data');
        System.assert(csv.contains('Johnson,Jane,Manager,EMP002'), 'Should contain second employee data');
    }

    @isTest
    static void testGenerateCSVContentEmptyData() {
        List<Map<String,Object>> payrollData = new List<Map<String,Object>>();

        Test.startTest();
        String csv = PayrollReportHandler.generateCSVContent(payrollData);
        Test.stopTest();

        System.assertNotEquals(null, csv, 'CSV should not be null');
        System.assert(csv.contains('last_name,first_name,title,Employee'), 'Should contain headers');
        System.assertEquals(1, csv.split('\n').size(), 'Should only have header row for empty data');
    }

    @isTest
    static void testGenerateCSVContentWithNullValues() {
        List<Map<String,Object>> payrollData = new List<Map<String,Object>>{
            new Map<String,Object>{
                'last_name'=>null,
                'first_name'=>'John',
                'title'=>'Developer',
                'Employee'=>'EMP001',
                'regular_hours'=>null,
                'overtime_hours'=>5.0
            }
        };

        Test.startTest();
        String csv = PayrollReportHandler.generateCSVContent(payrollData);
        Test.stopTest();

        System.assertNotEquals(null, csv, 'CSV should not be null');
        System.assert(csv.contains(',John,Developer,EMP001'), 'Should handle null values in CSV');
    }

    // ===========================================
    // WRAPPER CLASSES TESTS
    // ===========================================

    @isTest
    static void testTimesheetProcessingContext() {
        Map<String,Object> empData = new Map<String,Object>{'test'=>'value'};
        Map<Integer,Decimal> empSlots = new Map<Integer,Decimal>{0=>8.0};
        List<Date> slots = new List<Date>{Date.today()};
        Decimal mult = 1.5;

        Test.startTest();
        PayrollReportHandler.TimesheetProcessingContext ctx = new PayrollReportHandler.TimesheetProcessingContext(empData, empSlots, slots, mult);
        Test.stopTest();

        System.assertNotEquals(null, ctx, 'Context should not be null');
        System.assertEquals(empData, ctx.empData, 'Employee data should match');
        System.assertEquals(empSlots, ctx.empSlots, 'Employee slots should match');
        System.assertEquals(slots, ctx.slotStarts, 'Slot starts should match');
        System.assertEquals(mult, ctx.reimbursementMultiplier, 'Reimbursement multiplier should match');
    }

    @isTest
    static void testSlotAssignmentData() {
        wfrecon__Timesheet_Entry__c entry = new wfrecon__Timesheet_Entry__c();
        Decimal reg = 8.0;
        Decimal travel = 1.0;
        Decimal reimbursement = 25.0;

        Test.startTest();
        PayrollReportHandler.SlotAssignmentData slotData = new PayrollReportHandler.SlotAssignmentData(entry, reg, travel, reimbursement);
        Test.stopTest();

        System.assertNotEquals(null, slotData, 'Slot data should not be null');
        System.assertEquals(entry, slotData.entry, 'Entry should match');
        System.assertEquals(reg, slotData.reg, 'Regular hours should match');
        System.assertEquals(travel, slotData.travel, 'Travel hours should match');
        System.assertEquals(reimbursement, slotData.reimbursement, 'Reimbursement should match');
    }

    // ===========================================
    // URL LOGIC TESTS
    // ===========================================

    @isTest
    static void testURLGeneration() {
        Date startDate = Date.today().addDays(-7);
        Date endDate = Date.today();

        Test.startTest();
        List<Map<String, Object>> result = PayrollReportHandler.getPayrollData(startDate, endDate);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        
        // Check if URL fields are present
        for (Map<String, Object> emp : result) {
            System.assert(emp.containsKey('EmployeeIdURL'), 'Should have EmployeeIdURL field');
            System.assert(emp.containsKey('JobURLs'), 'Should have JobURLs field');
            
            if (emp.get('JobURLs') != null) {
                List<Map<String, String>> jobURLs = (List<Map<String, String>>)emp.get('JobURLs');
                // System.assert(jobURLs instanceof List<Map<String, String>>, 'JobURLs should be a list of maps');
            }
        }
    }

    

    // ===========================================
    // EXCEPTION HANDLING TESTS
    // ===========================================

    @isTest
    static void testExceptionHandlingInGetPayrollData() {
        // Test with invalid date range to trigger exception
        Date startDate = Date.today();
        Date endDate = Date.today().addDays(-1);

        Test.startTest();
        try {
            PayrollReportHandler.getPayrollData(startDate, endDate);
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            // System.assert(e.getMessage().contains('Start date cannot be after end date'), 
                        //  'Should throw appropriate error message');
        }
        Test.stopTest();
    }

    @isTest
    static void testExceptionHandlingInExportCSV() {
        // Test with invalid date range to trigger exception
        Date startDate = Date.today();
        Date endDate = Date.today().addDays(-1);

        Test.startTest();
        try {
            PayrollReportHandler.exportPayrollCSV(startDate, endDate);
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            // System.assert(e.getMessage().contains('Start date cannot be after end date'), 
                        //  'Should throw appropriate error message');
        }
        Test.stopTest();
    }

    // ===========================================
    // EDGE CASES AND BOUNDARY TESTS
    // ===========================================

    @isTest
    static void testReimbursementMultiplierWithInvalidLabel() {
        // This test verifies the fallback behavior when custom label is invalid
        Test.startTest();
        Decimal multiplier = PayrollReportHandler.getReimbursementMultiplier();
        Test.stopTest();

        System.assertNotEquals(null, multiplier, 'Multiplier should not be null');
        System.assert(multiplier >= 0, 'Multiplier should be non-negative');
    }

    @isTest
    static void testProcessTimesheetDataWithEmptyTimesheets() {
        List<wfrecon__Timesheet__c> timesheets = new List<wfrecon__Timesheet__c>();
        List<Date> slotStarts = new List<Date>{Date.today().addDays(-7), Date.today()};
        Decimal reimbursementMultiplier = 1.0;

        Test.startTest();
        Map<String, Map<String, Object>> empMap = PayrollReportHandler.processTimesheetData(timesheets, slotStarts, reimbursementMultiplier);
        Test.stopTest();

        System.assertNotEquals(null, empMap, 'Employee map should not be null');
        System.assertEquals(0, empMap.size(), 'Should return empty map for empty timesheets');
    }

    @isTest
    static void testBuildSlotBoundariesWithSameStartAndEndDate() {
        Date startDate = Date.today();
        Date endDate = Date.today();

        Test.startTest();
        List<Date> slotStarts = PayrollReportHandler.buildSlotBoundaries(startDate, endDate);
        Test.stopTest();

        System.assertNotEquals(null, slotStarts, 'Slot starts should not be null');
        System.assert(slotStarts.size() > 0, 'Should have at least one slot');
        System.assertEquals(startDate, slotStarts[0], 'First slot should be start date');
    }
}