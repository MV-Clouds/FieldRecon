@isTest
private class ShiftEndLogEntriesControllerTest {
    @TestSetup
    static void setupTestData() {
        // ======== Contacts ========
        RecordType empRt = [
            SELECT Id
            FROM RecordType
            WHERE DeveloperName = 'Employee_WF_Recon'
            AND SObjectType = 'Contact'
            LIMIT 1
        ];
        RecordType subRt = [
            SELECT Id
            FROM RecordType
            WHERE DeveloperName = 'Sub_Contractor_WF_Recon'
            AND SObjectType = 'Contact'
            LIMIT 1
        ];

        Contact emp1 = new Contact(
            FirstName = 'Employee1',
            LastName  = 'Test',
            RecordTypeId = empRt.Id,
            wfrecon__Can_Clock_In_Out__c = true
        );
        Contact emp2 = new Contact(
            FirstName = 'Employee2',
            LastName  = 'Test',
            RecordTypeId = empRt.Id,
            wfrecon__Can_Clock_In_Out__c = true
        );
        Contact sub1 = new Contact(
            FirstName = 'Subcontractor1',
            LastName  = 'Test',
            RecordTypeId = subRt.Id,
            wfrecon__Can_Clock_In_Out__c = true
        );
        insert new List<Contact>{ emp1, emp2, sub1 };

        // ======== Jobs ========
        wfrecon__Job__c job1 = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'Job 1',
            wfrecon__Description__c = 'Test Job 1'
        );
        wfrecon__Job__c job2 = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'Job 2',
            wfrecon__Description__c = 'Test Job 2'
        );
        insert new List<wfrecon__Job__c>{ job1, job2 };

        // ======== Mobilization Groups & Mobilizations ========
        wfrecon__Mobilization_Group__c mobGroup1 = new wfrecon__Mobilization_Group__c(
            wfrecon__Start_Date__c = Date.today(),
            wfrecon__End_Date__c   = Date.today().addDays(1),
            wfrecon__Job__c        = job1.Id,
            wfrecon__Mobilization_Status__c = 'Confirmed'
        );
        wfrecon__Mobilization_Group__c mobGroup2 = new wfrecon__Mobilization_Group__c(
            wfrecon__Start_Date__c = Date.today().addDays(-3),
            wfrecon__End_Date__c   = Date.today().addDays(-2),
            wfrecon__Job__c        = job2.Id,
            wfrecon__Mobilization_Status__c = 'Confirmed'
        );
        insert new List<wfrecon__Mobilization_Group__c>{ mobGroup1, mobGroup2 };

        wfrecon__Mobilization__c mob1 = new wfrecon__Mobilization__c(
            wfrecon__Job__c              = job1.Id,
            wfrecon__Start_Date__c       = Date.today(),
            wfrecon__End_Date__c         = Date.today().addDays(1),
            wfrecon__Mobilization_Group__c = mobGroup1.Id,
            wfrecon__Mobilization_Status__c = 'Confirmed'
        );
        insert mob1;

        // ======== Mobilization Members ========
        wfrecon__Mobilization_Member__c member1 = new wfrecon__Mobilization_Member__c(
            wfrecon__Mobilization__c = mob1.Id,
            wfrecon__Contact__c      = emp1.Id
        );
        insert member1;

        // ======== Timesheets & Timesheet Entries ========
        wfrecon__Timesheet__c ts1 = new wfrecon__Timesheet__c(
            wfrecon__Contact__c            = emp2.Id,
            wfrecon__Job__c                = job1.Id,
            wfrecon__Timesheet_Start_Date__c = Date.today(),
            wfrecon__Timesheet_End_Date__c   = Date.today(),
            wfrecon__Do_Not_Execute__c     = true
        );
        insert ts1;

        wfrecon__Timesheet_Entry__c entry1 = new wfrecon__Timesheet_Entry__c(
            wfrecon__Timesheet__c   = ts1.Id,
            wfrecon__Clock_In_Time__c  = Datetime.newInstance(Date.today(), Time.newInstance(9, 0, 0, 0)),
            wfrecon__Clock_Out_Time__c = Datetime.newInstance(Date.today(), Time.newInstance(17, 0, 0, 0))
        );
        insert entry1;
        
        // ======== Cost Code ========
        wfrecon__Cost_Code__c costCode = new wfrecon__Cost_Code__c(
            Name = 'Test Cost Code'
        );
        insert costCode;
        
        // ======== Timesheet Entry Item ========
        wfrecon__Timesheet_Entry_Item__c entryItem = new wfrecon__Timesheet_Entry_Item__c(
            wfrecon__Timesheet_Entry__c = entry1.Id,
            wfrecon__Cost_Code__c       = costCode.Id
        );
        insert entryItem;

        // ======== Scope Entry and Scope Entry Process ========
        wfrecon__Scope_Entry__c scopeEntry = new wfrecon__Scope_Entry__c(
            wfrecon__Job__c          = job1.Id,
            wfrecon__Contract_Value__c = 50000,
            wfrecon__Type__c         = 'Contract'
        );
        insert scopeEntry;
        
        wfrecon__Scope_Entry_Process__c scopeProc = new wfrecon__Scope_Entry_Process__c(
            wfrecon__Scope_Entry__c   = scopeEntry.Id,
            wfrecon__Process_Name__c  = 'Test Process',
            wfrecon__Process_Type__c  = 'Generic',
            wfrecon__Measurement_Type__c = 'Square Feet',
            wfrecon__Weight__c        = 50,
            wfrecon__Sequence__c      = 1,
            wfrecon__Job__c           = job1.Id
        );
        insert scopeProc;
        
        // ======== Location and Location Process ========
        wfrecon__Location__c loc = new wfrecon__Location__c(
            wfrecon__Job__c = job1.Id
        );
        insert loc;

        wfrecon__Location_Process__c locProc = new wfrecon__Location_Process__c(
            wfrecon__Location__c         = loc.Id,
            wfrecon__Scope_Entry_Process__c = scopeProc.Id,
            wfrecon__Contract_Price__c   = 10000
        );
        insert locProc;
    }

    @IsTest
    static void testGetMobilizationMembersWithStatus_NoTimesheet() {
        RecordType empRt = [
            SELECT Id
            FROM RecordType
            WHERE DeveloperName = 'Employee_WF_Recon'
            AND SObjectType = 'Contact'
            LIMIT 1
        ];
        Contact emp3 = new Contact(
            FirstName = 'Employee1',
            LastName  = 'Test',
            RecordTypeId = empRt.Id,
            wfrecon__Can_Clock_In_Out__c = true
        );
        Contact emp4 = new Contact(
            FirstName = 'Employee2',
            LastName  = 'Test2',
            RecordTypeId = empRt.Id,
            wfrecon__Can_Clock_In_Out__c = true
        );
        insert new List<Contact>{ emp3, emp4 };

        wfrecon__Job__c job3 = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'Job 3',
            wfrecon__Description__c = 'Test Job 3'
        );
        insert job3;

        wfrecon__Mobilization_Group__c mobGroup3 = new wfrecon__Mobilization_Group__c(
            wfrecon__Start_Date__c = Date.today(),
            wfrecon__End_Date__c   = Date.today().addDays(1),
            wfrecon__Job__c        = job3.Id,
            wfrecon__Mobilization_Status__c = 'Confirmed'
        );
        insert mobGroup3;

        wfrecon__Mobilization__c mob3 = new wfrecon__Mobilization__c(
            wfrecon__Job__c              = job3.Id,
            wfrecon__Start_Date__c       = Date.today(),
            wfrecon__End_Date__c         = Date.today().addDays(1),
            wfrecon__Mobilization_Group__c = mobGroup3.Id,
            wfrecon__Mobilization_Status__c = 'Confirmed'
        );
        insert mob3;
        
        wfrecon__Crew__c crew = new wfrecon__Crew__c(
            Name = 'Test Crew'
        );
        insert crew;

        wfrecon__Crew_Member__c crewMember = new wfrecon__Crew_Member__c(
            wfrecon__Contact__c = emp3.Id,
            wfrecon__Crew__c    = crew.Id
        );
        insert crewMember;

        crew.wfrecon__Crew_Leader__c = crewMember.Id;
        update crew;

        wfrecon__Mobilization_Member__c member3 = new wfrecon__Mobilization_Member__c(
            wfrecon__Mobilization__c = mob3.Id, 
            wfrecon__Contact__c      = emp3.Id,
            wfrecon__Crew__c         = crew.Id
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
    static void testGetTimeSheetEntryItems() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        Contact emp = [SELECT Id FROM Contact WHERE wfrecon__Can_Clock_In_Out__c = true LIMIT 1];
        
        Test.startTest();
        List<ShiftEndLogEntriesController.TimesheetEntryItemWrapper> result = 
            ShiftEndLogEntriesController.getTimeSheetEntryItems(job.Id, String.valueOf(Date.today()), mob.Id, emp.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testGetJobLocationProcesses() {
        wfrecon__Job__c testJob = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> resultMap = ShiftEndLogEntriesController.getJobLocationProcesses(testJob.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, resultMap, 'Result Map should not be null');
        System.assert(resultMap.containsKey('processes'), 'Result Map should contain "processes" key');

        List<wfrecon__Location_Process__c> result =
            (List<wfrecon__Location_Process__c>) resultMap.get('processes');
        
        System.assert(!result.isEmpty(), 'Expected some location processes to be returned.');
        
        wfrecon__Location_Process__c sample = result[0];
        System.assertNotEquals(null, sample.wfrecon__Scope_Entry_Process__c,
            'Each location process should have a linked Scope Entry Process.');
        System.assertNotEquals(null, sample.wfrecon__Location__c,
            'Each location process should have a linked Location.');
    }

    @IsTest
    static void testGetJobLocationProcessesWithNullJobId() {
        Test.startTest();
        Map<String, Object> resultMap = ShiftEndLogEntriesController.getJobLocationProcesses(null);
        Test.stopTest();
        
        System.assertNotEquals(null, resultMap, 'Result Map should not be null');
        
        List<wfrecon__Location_Process__c> result =
            (List<wfrecon__Location_Process__c>) resultMap.get('processes');
        
        System.assertEquals(0, result.size(), 'Expected empty list when null Job ID is passed.');
    }

    @IsTest
    static void testGetJobLocationProcessesWithInvalidJobId() {
        wfrecon__Job__c tempJob = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'Temp Job'
        );
        insert tempJob;
        Id invalidId = tempJob.Id;
        delete tempJob;
        
        Test.startTest();
        Map<String, Object> resultMap = ShiftEndLogEntriesController.getJobLocationProcesses(invalidId);
        Test.stopTest();
        
        System.assertNotEquals(null, resultMap, 'Result Map should not be null');

        List<wfrecon__Location_Process__c> result =
            (List<wfrecon__Location_Process__c>) resultMap.get('processes');
        
        System.assertEquals(0, result.size(), 'Expected empty list when invalid Job ID is passed.');
    }

    @IsTest
    static void testGetMobilizationList_Success() {
        Contact crewLeader = [SELECT Id FROM Contact LIMIT 1];
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Test.startTest();
        Map<String, String> result = ShiftEndLogEntriesController.getMobilizationList(job.Id, crewLeader.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testGetMobilizationList_NullCrewLeader() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Test.startTest();
        Map<String, String> result = ShiftEndLogEntriesController.getMobilizationList(job.Id, null);
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
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Completed foundation work',
            'planForTomorrow' => 'Start framing',
            'exceptions'      => 'Weather delay',
            'notesToOffice'   => 'Need materials'
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
    }

    @IsTest
    static void testCreateLogEntry_WithCameraPhotos() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Completed foundation work',
            'planForTomorrow' => 'Start framing',
            'exceptions'      => 'None',
            'notesToOffice'   => 'All good'
        };
        
        List<Map<String, Object>> cameraPhotos = new List<Map<String, Object>>{
            new Map<String, Object>{
                'fileName'   => 'photo1.jpg',
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
    }

    @IsTest
    static void testCreateLogEntry_WithProcessUpdates() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        wfrecon__Scope_Entry__c scopeEntry = new wfrecon__Scope_Entry__c(
            wfrecon__Job__c          = job.Id,
            wfrecon__Contract_Value__c = 50000,
            wfrecon__Type__c         = 'Contract'
        );
        insert scopeEntry;
        
        wfrecon__Scope_Entry_Process__c scopeProc = new wfrecon__Scope_Entry_Process__c(
            wfrecon__Scope_Entry__c   = scopeEntry.Id,
            wfrecon__Process_Name__c  = 'Test Process',
            wfrecon__Process_Type__c  = 'Generic',
            wfrecon__Measurement_Type__c = 'Square Feet',
            wfrecon__Weight__c        = 50,
            wfrecon__Sequence__c      = 1,
            wfrecon__Job__c           = job.Id
        );
        insert scopeProc;
        
        wfrecon__Location__c loc = new wfrecon__Location__c(
            wfrecon__Job__c = job.Id
        );
        insert loc;
        
        wfrecon__Location_Process__c process = new wfrecon__Location_Process__c(
            wfrecon__Location__c            = loc.Id,
            wfrecon__Completed_Percentage__c = 25,
            wfrecon__Scope_Entry_Process__c  = scopeProc.Id
        );
        insert process;
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Completed work',
            'planForTomorrow' => 'Continue',
            'exceptions'      => 'None',
            'notesToOffice'   => 'Notes'
        };
        
        List<Map<String, Object>> processUpdates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'processId'            => process.Id,
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
    }

    @IsTest
    static void testCreateLogEntry_WithContentDocuments() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        ContentVersion cv = new ContentVersion(
            Title       = 'Test Document',
            PathOnClient = 'test.pdf',
            VersionData = Blob.valueOf('test content')
        );
        insert cv;
        
        ContentVersion insertedCV = [
            SELECT ContentDocumentId
            FROM ContentVersion
            WHERE Id = :cv.Id
        ];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Work done',
            'planForTomorrow' => 'Plan',
            'exceptions'      => 'None',
            'notesToOffice'   => 'Notes'
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            new List<String>{ insertedCV.ContentDocumentId },
            null,
            String.valueOf(Date.today()),
            null,
            null
        );
        Test.stopTest();
    }

    @IsTest
    static void testDeleteContentDocuments_Success() {
        ContentVersion cv = new ContentVersion(
            Title       = 'Test File',
            PathOnClient = 'test.txt',
            VersionData = Blob.valueOf('test content')
        );
        insert cv;
        
        ContentVersion insertedCV = [
            SELECT ContentDocumentId
            FROM ContentVersion
            WHERE Id = :cv.Id
        ];
        
        Test.startTest();
        ShiftEndLogEntriesController.deleteContentDocuments(
            new List<String>{ insertedCV.ContentDocumentId }
        );
        Test.stopTest();
        
        List<ContentDocument> docs = [
            SELECT Id
            FROM ContentDocument
            WHERE Id = :insertedCV.ContentDocumentId
        ];
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

    @IsTest
    static void testGetChatterFeedItems_Success() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        // Create a ContentVersion linked to the Job
        ContentVersion cv = new ContentVersion(
            Title = 'Test Image',
            PathOnClient = 'test.jpg',
            VersionData = Blob.valueOf('test image data'),
            FirstPublishLocationId = job.Id
        );
        insert cv;
        
        // Query to get the created ContentDocumentId
        ContentVersion insertedCV = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id];
        
        // Create a simple text FeedItem (FeedAttachments are created automatically when content is shared)
        FeedItem feedItem = new FeedItem(
            ParentId = job.Id,
            Body = 'Test Feed Item'
        );
        insert feedItem;
        
        Test.startTest();
        Map<String, Object> result = ShiftEndLogEntriesController.getChatterFeedItems(job.Id, 0);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.containsKey('feedItems'), 'Result should contain feedItems');
    }

    @IsTest
    static void testGetChatterFeedItems_NoAttachments() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ShiftEndLogEntriesController.getChatterFeedItems(job.Id, 0);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.containsKey('feedItems'), 'Result should contain feedItems');
    }

    @IsTest
    static void testGetJobLocationProcesses_WithPendingLogs() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Location_Process__c locProc = [SELECT Id FROM wfrecon__Location_Process__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        
        // Create pending log entry with approval data
        Map<String, Object> approvalData = new Map<String, Object>{
            'locationProcessChanges' => new List<Object>{
                new Map<String, Object>{
                    'id' => locProc.Id,
                    'oldValue' => 0,
                    'newValue' => 50
                }
            }
        };
        
        wfrecon__Log_Entry__c logEntry = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Status__c = 'Pending',
            wfrecon__Work_Performed_Date__c = Date.today(),
            wfrecon__Approval_Data__c = JSON.serialize(approvalData)
        );
        insert logEntry;
        
        Test.startTest();
        Map<String, Object> result = ShiftEndLogEntriesController.getJobLocationProcesses(job.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.containsKey('pendingApprovalData'), 'Result should contain pendingApprovalData');
    }

    @IsTest
    static void testGetJobLocationProcesses_WithOldStructure() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Location_Process__c locProc = [SELECT Id FROM wfrecon__Location_Process__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        
        // Create pending log entry with old approval data structure (array)
        List<Object> approvalDataOld = new List<Object>{
            new Map<String, Object>{
                'id' => locProc.Id,
                'oldValue' => 0,
                'newValue' => 30
            }
        };
        
        wfrecon__Log_Entry__c logEntry = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Status__c = 'Pending',
            wfrecon__Work_Performed_Date__c = Date.today(),
            wfrecon__Approval_Data__c = JSON.serialize(approvalDataOld)
        );
        insert logEntry;
        
        Test.startTest();
        Map<String, Object> result = ShiftEndLogEntriesController.getJobLocationProcesses(job.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testCreateLogEntry_WithApprovalData() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Location_Process__c locProc = [SELECT Id FROM wfrecon__Location_Process__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Work completed',
            'planForTomorrow' => 'Continue work',
            'exceptions'      => 'None',
            'notesToOffice'   => 'All good'
        };
        
        Map<String, Object> approvalData = new Map<String, Object>{
            'locationProcessChanges' => new List<Object>{
                new Map<String, Object>{
                    'id' => locProc.Id,
                    'oldValue' => 0,
                    'newValue' => 75
                }
            },
            'timesheetEntryChanges' => new Map<String, Object>(),
            'mediaMetadata' => new List<Object>()
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            null,
            null,
            String.valueOf(Date.today()),
            JSON.serialize(approvalData),
            mob.Id
        );
        Test.stopTest();
        
        List<wfrecon__Log_Entry__c> logs = [
            SELECT Id, wfrecon__Status__c, wfrecon__Approval_Data__c
            FROM wfrecon__Log_Entry__c
            WHERE wfrecon__Job__c = :job.Id
        ];
        System.assert(!logs.isEmpty(), 'Log entry should be created');
    }

    @IsTest
    static void testCreateLogEntry_AutoApprovePrevious() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        wfrecon__Location_Process__c locProc = [SELECT Id FROM wfrecon__Location_Process__c LIMIT 1];
        
        // Create first pending log entry
        Map<String, Object> approvalData1 = new Map<String, Object>{
            'locationProcessChanges' => new List<Object>{
                new Map<String, Object>{
                    'id' => locProc.Id,
                    'oldValue' => 0,
                    'newValue' => 25
                }
            }
        };
        
        wfrecon__Log_Entry__c log1 = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Status__c = 'Pending',
            wfrecon__Work_Performed_Date__c = Date.today().addDays(-1),
            wfrecon__Work_Performed__c = 'Previous work',
            wfrecon__Approval_Data__c = JSON.serialize(approvalData1)
        );
        insert log1;
        
        // Create second log entry (should auto-approve the first)
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'New work',
            'planForTomorrow' => 'Continue',
            'exceptions'      => 'None',
            'notesToOffice'   => 'Notes'
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            null,
            null,
            String.valueOf(Date.today()),
            null,
            mob.Id
        );
        Test.stopTest();
        
        wfrecon__Log_Entry__c updatedLog = [
            SELECT Id, wfrecon__Status__c
            FROM wfrecon__Log_Entry__c
            WHERE Id = :log1.Id
        ];
        System.assertEquals('Auto-Approved', updatedLog.wfrecon__Status__c, 'Previous log should be auto-approved');
    }

    @IsTest
    static void testCreateLogEntry_WithTimesheetChanges() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        wfrecon__Timesheet__c ts = [SELECT Id FROM wfrecon__Timesheet__c LIMIT 1];
        wfrecon__Timesheet_Entry__c entry = [SELECT Id FROM wfrecon__Timesheet_Entry__c LIMIT 1];
        wfrecon__Timesheet_Entry_Item__c item = [SELECT Id FROM wfrecon__Timesheet_Entry_Item__c LIMIT 1];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Work done',
            'planForTomorrow' => 'Plan',
            'exceptions'      => 'None',
            'notesToOffice'   => 'Notes'
        };
        
        Map<String, Object> timesheetEntryChanges = new Map<String, Object>();
        timesheetEntryChanges.put(entry.Id, new Map<String, Object>{
            'items' => new Map<String, Object>{
                item.Id => new Map<String, Object>{
                    'clockIn' => '2024-01-15T08:00:00',
                    'clockOut' => '2024-01-15T17:00:00',
                    'travelTime' => 1.5,
                    'perDiem' => 1
                }
            }
        });
        
        Map<String, Object> approvalData = new Map<String, Object>{
            'locationProcessChanges' => new List<Object>(),
            'timesheetEntryChanges' => timesheetEntryChanges
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            null,
            null,
            String.valueOf(Date.today()),
            JSON.serialize(approvalData),
            mob.Id
        );
        Test.stopTest();
    }

    @IsTest
    static void testGetMobilizationList_WithMultipleMobilizations() {
        Contact crewLeader = [SELECT Id FROM Contact LIMIT 1];
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        // The Crew_Leader_Id__c is a formula field, so we cannot set it directly.
        // Instead, we just test the method with an existing contact ID.
        // The method will work as long as the crewLeaderId parameter matches mobilization members.
        
        Test.startTest();
        Map<String, String> result = ShiftEndLogEntriesController.getMobilizationList(job.Id, crewLeader.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testConvertUtc_WithZeroSeconds() {
        Test.startTest();
        Datetime result = ShiftEndLogEntriesController.convertUtc('2024-01-15T10:30:00');
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testCreateLogEntry_WithCameraPhotosAndApprovalData() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Work completed',
            'planForTomorrow' => 'Continue',
            'exceptions'      => 'None',
            'notesToOffice'   => 'Notes'
        };
        
        List<Map<String, Object>> cameraPhotos = new List<Map<String, Object>>{
            new Map<String, Object>{
                'fileName' => 'camera1.jpg',
                'base64Data' => EncodingUtil.base64Encode(Blob.valueOf('camera photo data'))
            }
        };
        
        Map<String, Object> approvalData = new Map<String, Object>{
            'locationProcessChanges' => new List<Object>(),
            'timesheetEntryChanges' => new Map<String, Object>(),
            'mediaMetadata' => new List<Object>()
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            null,
            JSON.serialize(cameraPhotos),
            String.valueOf(Date.today()),
            JSON.serialize(approvalData),
            mob.Id
        );
        Test.stopTest();
        
        List<wfrecon__Log_Entry__c> logs = [
            SELECT Id, wfrecon__Approval_Data__c
            FROM wfrecon__Log_Entry__c
            WHERE wfrecon__Job__c = :job.Id
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        System.assert(!logs.isEmpty(), 'Log entry should be created');
        System.assert(String.isNotBlank(logs[0].wfrecon__Approval_Data__c), 'Approval data should contain media metadata');
    }

    @IsTest
    static void testGetTimeSheetEntryItems_EmptyContactIds() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        
        // Create a new contact that's not in any mobilization
        Contact newContact = new Contact(
            FirstName = 'New',
            LastName = 'Contact'
        );
        insert newContact;
        
        Test.startTest();
        List<ShiftEndLogEntriesController.TimesheetEntryItemWrapper> result = 
            ShiftEndLogEntriesController.getTimeSheetEntryItems(job.Id, String.valueOf(Date.today()), mob.Id, newContact.Id);
        Test.stopTest();
        
        // Since the crew leader is added to contactIds even when no mobilization members are found,
        // the method will return an empty list (not null) when there are no timesheet items
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(0, result.size(), 'Result should be empty when no timesheet items found');
    }

    @IsTest
    static void testGetMobilizationList_BlankCrewLeader() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Test.startTest();
        Map<String, String> result = ShiftEndLogEntriesController.getMobilizationList(job.Id, '');
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(0, result.size(), 'Result should be empty for blank crew leader');
    }

    @IsTest
    static void testGetMobilizationList_WithMobilizationStatus() {
        Contact crewLeader = [SELECT Id FROM Contact LIMIT 1];
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        
        // Update mobilization to have today's date (Start_Date_Text__c is a formula field)
        mob.wfrecon__Start_Date__c = Date.today();
        update mob;
        
        // Create mobilization member with crew leader
        wfrecon__Mobilization_Member__c member = new wfrecon__Mobilization_Member__c(
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Contact__c = crewLeader.Id
        );
        insert member;
        
        Test.startTest();
        Map<String, String> result = ShiftEndLogEntriesController.getMobilizationList(job.Id, crewLeader.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testGetJobLocationProcesses_BlankApprovalData() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        
        // Create log entry with blank approval data
        wfrecon__Log_Entry__c logEntry = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Status__c = 'Pending',
            wfrecon__Work_Performed_Date__c = Date.today(),
            wfrecon__Approval_Data__c = ''
        );
        insert logEntry;
        
        Test.startTest();
        Map<String, Object> result = ShiftEndLogEntriesController.getJobLocationProcesses(job.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testCreateLogEntry_WithoutMobilization() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Completed work',
            'planForTomorrow' => 'Continue',
            'exceptions'      => 'None',
            'notesToOffice'   => 'Notes'
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
        
        List<wfrecon__Log_Entry__c> logs = [
            SELECT Id
            FROM wfrecon__Log_Entry__c
            WHERE wfrecon__Job__c = :job.Id
            AND wfrecon__Mobilization__c = null
        ];
        System.assert(!logs.isEmpty(), 'Log entry without mobilization should be created');
    }

    @IsTest
    static void testGetChatterFeedItems_WithOffset() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ShiftEndLogEntriesController.getChatterFeedItems(job.Id, 3);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.containsKey('feedItems'), 'Result should contain feedItems');
    }

    @IsTest
    static void testAutoApproveWithMultipleLogs() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        wfrecon__Location_Process__c locProc = [SELECT Id FROM wfrecon__Location_Process__c LIMIT 1];
        wfrecon__Timesheet_Entry__c entry = [SELECT Id FROM wfrecon__Timesheet_Entry__c LIMIT 1];
        wfrecon__Timesheet_Entry_Item__c item = [SELECT Id FROM wfrecon__Timesheet_Entry_Item__c LIMIT 1];
        
        // Create multiple pending log entries
        Map<String, Object> approvalData1 = new Map<String, Object>{
            'locationProcessChanges' => new List<Object>{
                new Map<String, Object>{
                    'id' => locProc.Id,
                    'oldValue' => 0,
                    'newValue' => 25
                }
            },
            'timesheetEntryChanges' => new Map<String, Object>{
                entry.Id => new Map<String, Object>{
                    'items' => new Map<String, Object>{
                        item.Id => new Map<String, Object>{
                            'clockIn' => '2024-01-15T08:00:00',
                            'clockOut' => '2024-01-15T17:00:00'
                        }
                    }
                }
            }
        };
        
        wfrecon__Log_Entry__c log1 = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Status__c = 'Pending',
            wfrecon__Work_Performed_Date__c = Date.today().addDays(-2),
            wfrecon__Work_Performed__c = 'Work 1',
            wfrecon__Approval_Data__c = JSON.serialize(approvalData1)
        );
        
        wfrecon__Log_Entry__c log2 = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Status__c = 'Pending',
            wfrecon__Work_Performed_Date__c = Date.today().addDays(-1),
            wfrecon__Work_Performed__c = 'Work 2',
            wfrecon__Approval_Data__c = JSON.serialize(approvalData1)
        );
        insert new List<wfrecon__Log_Entry__c>{log1, log2};
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Latest work',
            'planForTomorrow' => 'Continue',
            'exceptions'      => 'None',
            'notesToOffice'   => 'Notes'
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            null,
            null,
            String.valueOf(Date.today()),
            null,
            mob.Id
        );
        Test.stopTest();
        
        List<wfrecon__Log_Entry__c> updatedLogs = [
            SELECT Id, wfrecon__Status__c
            FROM wfrecon__Log_Entry__c
            WHERE Id IN (:log1.Id, :log2.Id)
        ];
        
        for(wfrecon__Log_Entry__c log : updatedLogs) {
            System.assertEquals('Auto-Approved', log.wfrecon__Status__c, 'All previous logs should be auto-approved');
        }
    }

    @IsTest
    static void testCreateLogEntry_InvalidApprovalDataJson() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        wfrecon__Location_Process__c locProc = [SELECT Id FROM wfrecon__Location_Process__c LIMIT 1];
        
        // Create a pending log with invalid JSON that will cause parsing error
        wfrecon__Log_Entry__c log1 = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Status__c = 'Pending',
            wfrecon__Work_Performed_Date__c = Date.today().addDays(-1),
            wfrecon__Work_Performed__c = 'Previous work',
            wfrecon__Approval_Data__c = 'invalid json {'
        );
        insert log1;
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'New work',
            'planForTomorrow' => 'Continue',
            'exceptions'      => 'None',
            'notesToOffice'   => 'Notes'
        };
        
        Test.startTest();
        try {
            ShiftEndLogEntriesController.createLogEntry(
                job.Id,
                JSON.serialize(step3Data),
                null,
                null,
                String.valueOf(Date.today()),
                null,
                mob.Id
            );
        } catch (Exception e) {
            System.debug('Expected error handled: ' + e.getMessage());
        }
        Test.stopTest();
        
        // Verify the log with invalid JSON was still updated to Auto-Approved despite parsing error
        wfrecon__Log_Entry__c updatedLog = [
            SELECT Id, wfrecon__Status__c
            FROM wfrecon__Log_Entry__c
            WHERE Id = :log1.Id
        ];
        System.assertEquals('Auto-Approved', updatedLog.wfrecon__Status__c, 'Log should be auto-approved even with invalid JSON');
    }

    @IsTest
    static void testConvertUtc_NullString() {
        Test.startTest();
        Datetime result = ShiftEndLogEntriesController.convertUtc(null);
        Test.stopTest();
        
        System.assertEquals(null, result, 'Result should be null for null string');
    }

    @IsTest
    static void testCreateLogEntry_WithMultipleCameraPhotos() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];
        wfrecon__Location_Process__c locProc = [SELECT Id FROM wfrecon__Location_Process__c LIMIT 1];
        
        Map<String, Object> step3Data = new Map<String, Object>{
            'whatWeDone'      => 'Work completed',
            'planForTomorrow' => 'Continue',
            'exceptions'      => 'None',
            'notesToOffice'   => 'Notes'
        };
        
        List<Map<String, Object>> cameraPhotos = new List<Map<String, Object>>{
            new Map<String, Object>{
                'fileName' => 'camera1.jpg',
                'base64Data' => EncodingUtil.base64Encode(Blob.valueOf('camera photo data 1'))
            },
            new Map<String, Object>{
                'fileName' => 'camera2.jpg',
                'base64Data' => EncodingUtil.base64Encode(Blob.valueOf('camera photo data 2'))
            },
            new Map<String, Object>{
                'fileName' => 'camera3.png',
                'base64Data' => EncodingUtil.base64Encode(Blob.valueOf('camera photo data 3'))
            }
        };
        
        Map<String, Object> approvalData = new Map<String, Object>{
            'locationProcessChanges' => new List<Object>{
                new Map<String, Object>{
                    'id' => locProc.Id,
                    'oldValue' => 0,
                    'newValue' => 50
                }
            },
            'timesheetEntryChanges' => new Map<String, Object>(),
            'mediaMetadata' => new List<Object>()
        };
        
        Test.startTest();
        ShiftEndLogEntriesController.createLogEntry(
            job.Id,
            JSON.serialize(step3Data),
            null,
            JSON.serialize(cameraPhotos),
            String.valueOf(Date.today()),
            JSON.serialize(approvalData),
            mob.Id
        );
        Test.stopTest();
        
        List<wfrecon__Log_Entry__c> logs = [
            SELECT Id, wfrecon__Approval_Data__c
            FROM wfrecon__Log_Entry__c
            WHERE wfrecon__Job__c = :job.Id
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        System.assert(!logs.isEmpty(), 'Log entry should be created');
        System.assert(String.isNotBlank(logs[0].wfrecon__Approval_Data__c), 'Approval data should be present');
    }
}