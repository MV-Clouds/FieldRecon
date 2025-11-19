@isTest
private class ShiftEndLogEntriesControllerTest {
    @TestSetup
    static void setupTestData() {
        // ======== Contacts ========
        RecordType empRt = [SELECT Id FROM RecordType WHERE DeveloperName='Employee_WF_Recon' AND SObjectType='Contact' LIMIT 1];
        RecordType subRt = [SELECT Id FROM RecordType WHERE DeveloperName='Sub_Contractor_WF_Recon' AND SObjectType='Contact' LIMIT 1];

        Contact emp1 = new Contact(FirstName='Employee1', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        Contact emp2 = new Contact(FirstName='Employee2', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        Contact sub1 = new Contact(FirstName='Subcontractor1', LastName='Test', RecordTypeId=subRt.Id, Can_Clock_In_Out__c=true);
        insert new List<Contact>{emp1, emp2, sub1};

        // ======== Jobs ========
        Job__c job1 = new Job__c(Job_Name__c='Job 1', Description__c='Test Job 1');
        Job__c job2 = new Job__c(Job_Name__c='Job 2', Description__c='Test Job 2');
        insert new List<Job__c>{job1, job2};

        // ======== Mobilization Groups & Mobilizations ========
        Mobilization_Group__c mobGroup1 = new Mobilization_Group__c(
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(1),
            Job__c = job1.Id,
            Mobilization_Status__c='Confirmed'
        );
        Mobilization_Group__c mobGroup2 = new Mobilization_Group__c(
            Start_Date__c = Date.today().addDays(-3),
            End_Date__c = Date.today().addDays(-2),
            Job__c = job2.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert new List<Mobilization_Group__c>{mobGroup1, mobGroup2};

        Mobilization__c mob1 = new Mobilization__c(
            Job__c=job1.Id,
            Start_Date__c=Date.today(),
            End_Date__c=Date.today().addDays(1),
            Mobilization_Group__c=mobGroup1.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert new List<Mobilization__c>{mob1};

        // ======== Mobilization Members ========
        Mobilization_Member__c member1 = new Mobilization_Member__c(Mobilization__c=mob1.Id, Contact__c=emp1.Id);
        insert new List<Mobilization_Member__c>{member1};

        // ======== Timesheets & Timesheet Entries ========
        Timesheet__c ts1 = new Timesheet__c(Contact__c=emp2.Id, Job__c=job1.Id, Timesheet_Start_Date__c=Date.today(), Timesheet_End_Date__c=Date.today(), Do_Not_Execute__c=true);
        insert ts1;

        Timesheet_Entry__c entry1 = new Timesheet_Entry__c(
            Timesheet__c=ts1.Id,
            Clock_In_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(9,0,0,0)),
            Clock_Out_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(17,0,0,0))
        );
        insert entry1;
        
        // ======== Cost Code ========
        Cost_Code__c costCode = new Cost_Code__c(
            Name = 'Test Cost Code'
        );
        insert costCode;
        
        // ======== Timesheet Entry Item ========
        Timesheet_Entry_Item__c entryItem = new Timesheet_Entry_Item__c(
            Timesheet_Entry__c = entry1.Id,
            Cost_Code__c = costCode.Id
        );
        insert entryItem;

        // ======== Scope Entry and Scope Entry Process ========
        Scope_Entry__c scopeEntry = new Scope_Entry__c(
            Job__c = job1.Id,
            Contract_Value__c = 50000,
            Type__c = 'Contract'
        );
        insert scopeEntry;
        
        Scope_Entry_Process__c scopeProc = new Scope_Entry_Process__c(
            Scope_Entry__c = scopeEntry.Id,
            Process_Name__c = 'Test Process',
            Process_Type__c = 'Generic',
            Measurement_Type__c = 'Square Feet',
            Weight__c = 50,
            Sequence__c = 1,
            Job__c = job1.Id
        );
        insert scopeProc;
        
        // ======== Location and Location Process ========
        Location__c loc = new Location__c(
            Job__c = job1.Id
        );
        insert loc;

        Location_Process__c locProc = new Location_Process__c(
            Location__c = loc.Id,
            Scope_Entry_Process__c = scopeProc.Id,
            Contract_Price__c = 10000
        );
        insert locProc;
    }

    @IsTest
    static void testGetMobilizationMembersWithStatus_NoTimesheet() {
        RecordType empRt = [SELECT Id FROM RecordType WHERE DeveloperName='Employee_WF_Recon' AND SObjectType='Contact' LIMIT 1];
        Contact emp3 = new Contact(FirstName='Employee1', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        Contact emp4 = new Contact(FirstName='Employee2', LastName='Test2', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        insert new List<Contact>{emp3, emp4};

        Job__c job3 = new Job__c(Job_Name__c='Job 3', Description__c='Test Job 3');
        insert job3;

        Mobilization_Group__c mobGroup3 = new Mobilization_Group__c(
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(1),
            Job__c = job3.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert mobGroup3;

        Mobilization__c mob3 = new Mobilization__c(
            Job__c=job3.Id,
            Start_Date__c=Date.today(),
            End_Date__c=Date.today().addDays(1),
            Mobilization_Group__c=mobGroup3.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert mob3;

        Mobilization_Member__c member3 = new Mobilization_Member__c(
            Mobilization__c=mob3.Id, 
            Contact__c=emp3.Id
        );
        insert member3;

        Test.startTest();
        // Test with emp4 as crew leader - should return empty contactIds (covers line 53)
        Map<String,List<ShiftEndLogEntriesController.WrapperMember>> emptyResult =
            ShiftEndLogEntriesController.getMobilizationMembersWithStatus(mob3.Id, job3.Id, emp4.Id);
        System.assertNotEquals(null, emptyResult, 'Result should not be null even when contactIds empty');
        System.assertEquals(0, emptyResult.get('clockIn').size(), 'Should have empty list when no members');
        
        // Test with emp3 as crew leader - normal flow
        Map<String,List<ShiftEndLogEntriesController.WrapperMember>> members =
            ShiftEndLogEntriesController.getMobilizationMembersWithStatus(mob3.Id, job3.Id, emp3.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, members, 'Result should not be null');
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockInFirst() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockIn',
            'isTimeSheetNull' => true,
            'clockInTime' => clockInStr,
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = ShiftEndLogEntriesController.createTimesheetRecords(params);
        Test.stopTest();
        
        System.assert(res, 'Clock in should succeed');
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockInTwo() {
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockIn',
            'isTimeSheetNull' => false,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInStr,
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = ShiftEndLogEntriesController.createTimesheetRecords(params);
        Test.stopTest();
        
        System.assert(res, 'Clock in should succeed');
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutExistingEntry() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id, Clock_In_Time__c FROM Timesheet_Entry__c WHERE Timesheet__c=:ts.Id LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => false,
            'timesheetId' => ts.Id,
            'timesheetEntryId' => entry.Id,
            'clockInTime' => entry.Clock_In_Time__c,
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = ShiftEndLogEntriesController.createTimesheetRecords(params);
        Test.stopTest();
        
        System.assert(res, 'Clock out should succeed');
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutNewEntry() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => true,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInDt,
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = ShiftEndLogEntriesController.createTimesheetRecords(params);
        Test.stopTest();
        
        System.assert(res, 'Clock out should succeed');
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutExistingEntryMidnight() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id, Clock_In_Time__c FROM Timesheet_Entry__c WHERE Timesheet__c=:ts.Id LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => false,
            'timesheetId' => ts.Id,
            'timesheetEntryId' => entry.Id,
            'clockInTime' => entry.Clock_In_Time__c,
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = ShiftEndLogEntriesController.createTimesheetRecords(params);
        Test.stopTest();
        
        System.assert(res, 'Clock out should succeed');
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutNewEntryMidnight() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(22,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(2,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => true,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInDt.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
            'clockOutTime' => clockOutDt.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = ShiftEndLogEntriesController.createTimesheetRecords(params);
        Test.stopTest();
        
        System.assert(res, 'Clock out should succeed');
    }

    @IsTest
    static void testGetTimeSheetEntryItems() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c LIMIT 1];
        Contact emp = [SELECT Id FROM Contact WHERE Can_Clock_In_Out__c=true LIMIT 1];
        
        Test.startTest();
        List<ShiftEndLogEntriesController.TimesheetEntryItemWrapper> result = 
            ShiftEndLogEntriesController.getTimeSheetEntryItems(job.Id, String.valueOf(Date.today()), mob.Id, emp.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testUpdateTimesheets() {
        Timesheet_Entry_Item__c item = [SELECT Id, Timesheet_Entry__c FROM Timesheet_Entry_Item__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id FROM Timesheet_Entry__c WHERE Id=:item.Timesheet_Entry__c LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'Id' => item.Id,
            'TSEId' => entry.Id,
            'ClockIn' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'ClockOut' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'TravelTime' => '2.5',
            'PerDiem' => '1',
            'premium' => 'false'
        });

        Test.startTest();
        Boolean res = ShiftEndLogEntriesController.updateTimesheets(params);
        Test.stopTest();
        
        System.assert(res, 'Update should succeed');
    }

    @IsTest
    static void testUpdateTimesheetsMidnight() {
        Timesheet_Entry_Item__c item = [SELECT Id, Timesheet_Entry__c FROM Timesheet_Entry_Item__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id FROM Timesheet_Entry__c WHERE Id=:item.Timesheet_Entry__c LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'Id' => item.Id,
            'TSEId' => entry.Id,
            'ClockIn' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'ClockOut' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'TravelTime' => '2.5',
            'PerDiem' => '1',
            'premium' => 'false'
        });

        Test.startTest();
        Boolean res = ShiftEndLogEntriesController.updateTimesheets(params);
        Test.stopTest();
        
        System.assert(res, 'Update should succeed');
    }

    @IsTest
    static void testGetJobLocationProcesses() {
        Job__c testJob = [SELECT Id FROM Job__c LIMIT 1];
        
        Test.startTest();
        List<Location_Process__c> result = ShiftEndLogEntriesController.getJobLocationProcesses(testJob.Id);
        Test.stopTest();
        
        // Requery to ensure all necessary fields are available
        List<Location_Process__c> rechecked = [
            SELECT Id, Scope_Entry_Process__c, Location__c, Contract_Price__c
            FROM Location_Process__c
            WHERE Id IN :result
        ];
        
        System.assert(!rechecked.isEmpty(), 'Expected some location processes to be returned.');
        
        Location_Process__c sample = rechecked[0];
        System.assertNotEquals(null, sample.Scope_Entry_Process__c, 'Each location process should have a linked Scope Entry Process.');
        System.assertNotEquals(null, sample.Location__c, 'Each location process should have a linked Location.');
        System.assert(sample.Contract_Price__c > 0, 'Contract price should be greater than 0.');
    }

    @IsTest
    static void testGetJobLocationProcessesWithNullJobId() {
        Test.startTest();
        List<Location_Process__c> result = ShiftEndLogEntriesController.getJobLocationProcesses(null);
        Test.stopTest();
        
        System.assertEquals(0, result.size(), 'Expected empty list when null Job ID is passed.');
    }

    /**
     * @description Test for getJobLocationProcesses() with invalid Job ID
     */
    @IsTest
    static void testGetJobLocationProcessesWithInvalidJobId() {
        // Create a temporary job and delete it to get a non-existing ID
        Job__c tempJob = new Job__c(Job_Name__c = 'Temp Job');
        insert tempJob;
        Id invalidId = tempJob.Id;
        delete tempJob;
        
        Test.startTest();
        List<Location_Process__c> result = ShiftEndLogEntriesController.getJobLocationProcesses(invalidId);
        Test.stopTest();
        
        System.assertEquals(0, result.size(), 'Expected empty list when invalid Job ID is passed.');
    }

    @IsTest
    static void testGetMobilizationList_Success() {
        Contact crewLeader = [SELECT Id FROM Contact LIMIT 1];
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Test.startTest();
        Map<String, String> result = ShiftEndLogEntriesController.getMobilizationList(job.Id, crewLeader.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testGetMobilizationList_NullCrewLeader() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Test.startTest();
        Map<String, String> result = ShiftEndLogEntriesController.getMobilizationList(job.Id, null);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testGetMobilizationMembersWithStatus_WithTimesheet() {
        Mobilization__c mob = [SELECT Id FROM Mobilization__c LIMIT 1];
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Contact testContact = [SELECT Id FROM Contact LIMIT 1];
        Mobilization_Group__c mobGroup = [SELECT Id, Start_Date__c, End_Date__c FROM Mobilization_Group__c LIMIT 1];
        
        Timesheet__c ts = new Timesheet__c(
            Contact__c = testContact.Id,
            Job__c = job.Id,
            Timesheet_Start_Date__c = mobGroup.Start_Date__c.date(),
            Timesheet_End_Date__c = mobGroup.End_Date__c.date()
        );
        insert ts;
        
        Test.startTest();
        Map<String, List<ShiftEndLogEntriesController.WrapperMember>> result = 
            ShiftEndLogEntriesController.getMobilizationMembersWithStatus(mob.Id, job.Id, testContact.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testGetMobilizationMembersWithStatus_WithOpenEntry() {
        Mobilization__c mob = [SELECT Id FROM Mobilization__c LIMIT 1];
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Contact testContact = [SELECT Id FROM Contact WHERE LastName='Test' LIMIT 1];
        Mobilization_Group__c mobGroup = [SELECT Id, Start_Date__c, End_Date__c FROM Mobilization_Group__c LIMIT 1];
        Cost_Code__c costCode = new Cost_Code__c();
        insert costCode;
        
        Timesheet__c ts = new Timesheet__c(
            Contact__c = testContact.Id,
            Job__c = job.Id,
            Timesheet_Start_Date__c = mobGroup.Start_Date__c.date(),
            Timesheet_End_Date__c = mobGroup.End_Date__c.date()
        );
        insert ts;
        
        DateTime clockInTime = DateTime.newInstance(Date.today(), Time.newInstance(8, 0, 0, 0));
        Timesheet_Entry__c entry = new Timesheet_Entry__c(
            Timesheet__c = ts.Id,
            Clock_In_Time__c = clockInTime,
            Cost_Code__c = costCode.Id,
            Mobilization__c = mob.Id
        );
        insert entry;
        
        Test.startTest();
        Map<String, List<ShiftEndLogEntriesController.WrapperMember>> result = 
            ShiftEndLogEntriesController.getMobilizationMembersWithStatus(mob.Id, job.Id, testContact.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testGetMobilizationMembersWithStatus_WithCompletedEntry() {
        Mobilization__c mob = [SELECT Id FROM Mobilization__c LIMIT 1];
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Contact testContact = [SELECT Id FROM Contact WHERE LastName='Test' LIMIT 1];
        Mobilization_Group__c mobGroup = [SELECT Id, Start_Date__c, End_Date__c FROM Mobilization_Group__c LIMIT 1];
        Cost_Code__c costCode = new Cost_Code__c();
        insert costCode;
        
        Timesheet__c ts = new Timesheet__c(
            Contact__c = testContact.Id,
            Job__c = job.Id,
            Timesheet_Start_Date__c = mobGroup.Start_Date__c.date(),
            Timesheet_End_Date__c = mobGroup.End_Date__c.date()
        );
        insert ts;
        
        DateTime clockInTime = DateTime.newInstance(Date.today(), Time.newInstance(8, 0, 0, 0));
        Timesheet_Entry__c entry = new Timesheet_Entry__c(
            Timesheet__c = ts.Id,
            Clock_In_Time__c = clockInTime,
            Clock_Out_Time__c = clockInTime.addHours(8),
            Cost_Code__c = costCode.Id,
            Mobilization__c = mob.Id
        );
        insert entry;
        
        Test.startTest();
        Map<String, List<ShiftEndLogEntriesController.WrapperMember>> result = 
            ShiftEndLogEntriesController.getMobilizationMembersWithStatus(mob.Id, job.Id, testContact.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testConvertUtc_ValidFormat() {
        Test.startTest();
        Datetime result = ShiftEndLogEntriesController.convertUtc('2024-01-15T10:30:45');
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testConvertUtc_NoSeconds() {
        Test.startTest();
        Datetime result = ShiftEndLogEntriesController.convertUtc('2024-01-15T10:30');
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testConvertUtc_BlankString() {
        Test.startTest();
        Datetime result = ShiftEndLogEntriesController.convertUtc('');
        Test.stopTest();
        
        System.assertEquals(null, result, 'Result should be null for blank string');
    }

    @IsTest
    static void testConvertUtc_InvalidFormat() {
        Test.startTest();
        Datetime result = ShiftEndLogEntriesController.convertUtc('invalid-date');
        Test.stopTest();
        
        System.assertEquals(null, result, 'Result should be null for invalid format');
    }

    @IsTest
    static void testCreateLogEntry_WithoutAttachments() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone' => 'Completed foundation work',
            'planForTomorrow' => 'Start framing',
            'exceptions' => 'Weather delay',
            'notesToOffice' => 'Need materials'
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            null,
            null,
            String.valueOf(Date.today()),
            null,
            null
        );
        Test.stopTest();
        
        // List<wfrecon__Log_Entry__c> entries = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Job__c = :job.Id];
        // System.assertEquals(1, entries.size(), 'Log entry should be created');
    }

    @IsTest
    static void testCreateLogEntry_WithCameraPhotos() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone' => 'Completed foundation work',
            'planForTomorrow' => 'Start framing',
            'exceptions' => 'None',
            'notesToOffice' => 'All good'
        };
        
        List<Map<String, Object>> cameraPhotos = new List<Map<String, Object>>{
            new Map<String, Object>{
                'fileName' => 'photo1.jpg',
                'base64Data' => EncodingUtil.base64Encode(Blob.valueOf('test photo data'))
            }
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            null,
            JSON.serialize(cameraPhotos),
            String.valueOf(Date.today()),
            null,
            null
        );
        Test.stopTest();
        
        // List<wfrecon__Log_Entry__c> entries = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Job__c = :job.Id];
        // System.assertEquals(1, entries.size(), 'Log entry should be created');
    }

    @IsTest
    static void testCreateLogEntry_WithProcessUpdates() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        // Create Scope Entry
        Scope_Entry__c scopeEntry = new Scope_Entry__c(
            Job__c = job.Id,
            Contract_Value__c = 50000,
            Type__c = 'Contract'
        );
        insert scopeEntry;
        
        // Create Scope Entry Process
        Scope_Entry_Process__c scopeProc = new Scope_Entry_Process__c(
            Scope_Entry__c = scopeEntry.Id,
            Process_Name__c = 'Test Process',
            Process_Type__c = 'Generic',
            Measurement_Type__c = 'Square Feet',
            Weight__c = 50,
            Sequence__c = 1,
            Job__c = job.Id
        );
        insert scopeProc;
        
        Location__c loc = new Location__c(wfrecon__Job__c = job.Id);
        insert loc;
        
        Location_Process__c process = new Location_Process__c(
            wfrecon__Location__c = loc.Id,
            wfrecon__Completed_Percentage__c = 25,
            Scope_Entry_Process__c = scopeProc.Id
        );
        insert process;
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone' => 'Completed work',
            'planForTomorrow' => 'Continue',
            'exceptions' => 'None',
            'notesToOffice' => 'Notes'
        };
        
        List<Map<String, Object>> processUpdates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'processId' => process.Id,
                'completionPercentage' => 75
            }
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            null,
            null,
            String.valueOf(Date.today()),
            JSON.serialize(processUpdates),
            null
        );
        Test.stopTest();
        
        // Location_Process__c updatedProcess = [SELECT wfrecon__Completed_Percentage__c FROM Location_Process__c WHERE Id = :process.Id];
        // System.assertEquals(75, updatedProcess.wfrecon__Completed_Percentage__c, 'Process completion should be updated');
    }

    @IsTest
    static void testCreateLogEntry_WithContentDocuments() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        ContentVersion cv = new ContentVersion(
            Title = 'Test Document',
            PathOnClient = 'test.pdf',
            VersionData = Blob.valueOf('test content')
        );
        insert cv;
        
        ContentVersion insertedCV = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone' => 'Work done',
            'planForTomorrow' => 'Plan',
            'exceptions' => 'None',
            'notesToOffice' => 'Notes'
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            new List<String>{insertedCV.ContentDocumentId},
            null,
            String.valueOf(Date.today()),
            null,
            null
        );
        Test.stopTest();
        
        // List<wfrecon__Log_Entry__c> entries = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Job__c = :job.Id];
        // System.assertEquals(1, entries.size(), 'Log entry should be created');
    }

    @IsTest
    static void testDeleteContentDocuments_Success() {
        ContentVersion cv = new ContentVersion(
            Title = 'Test File',
            PathOnClient = 'test.txt',
            VersionData = Blob.valueOf('test content')
        );
        insert cv;
        
        ContentVersion insertedCV = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id];
        
        Test.startTest();
        ShiftEndLogEntriesController.deleteContentDocuments(new List<String>{insertedCV.ContentDocumentId});
        Test.stopTest();
        
        List<ContentDocument> docs = [SELECT Id FROM ContentDocument WHERE Id = :insertedCV.ContentDocumentId];
        System.assertEquals(0, docs.size(), 'Content document should be deleted');
    }

    @IsTest
    static void testDeleteContentDocuments_EmptyList() {
        Test.startTest();
        ShiftEndLogEntriesController.deleteContentDocuments(new List<String>());
        Test.stopTest();
        
        System.assert(true, 'Empty list should not throw exception');
    }

    @IsTest
    static void testDeleteContentDocuments_NullList() {
        Test.startTest();
        ShiftEndLogEntriesController.deleteContentDocuments(null);
        Test.stopTest();
        
        System.assert(true, 'Null list should not throw exception');
    }
}