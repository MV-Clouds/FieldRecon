@IsTest
private class ApproveShiftEndLogsControllerTest {

    // Define the custom object API names 
    private static final String LOG_ENTRY_API = 'wfrecon__Log_Entry__c';
    private static final String JOB_API = 'wfrecon__Job__c';
    private static final String LOCATION_API = 'wfrecon__Location__c'; 
    private static final String TIMESHEET_ENTRY_API = 'Timesheet_Entry__c';
    private static final String TIMESHEET_ITEM_API = 'Timesheet_Entry_Item__c';
    private static final String LOCATION_PROCESS_API = 'Location_Process__c';
    private static final String SCOPE_PROCESS_API = 'Scope_Entry_Process__c';
    private static final String SCOPE_ENTRY_API = 'wfrecon__Scope_Entry__c'; 
    private static final String COST_CODE_API = 'wfrecon__Cost_Code__c'; 
    private static final String APPROVER_METADATA_API = 'wfrecon__Log_Entry_Approver__mdt'; 

    /**
     * @description: Setup method to create all necessary test data
     */
    @TestSetup
    static void setupTestData() {
        // 1. Create System Admin Profile/User
        Profile sysAdminProfile = [SELECT Id FROM Profile WHERE Name = 'System Administrator' LIMIT 1];
        User sysAdmin = new User(
            Alias = 'sysadm', Email = 'sysadmin' + DateTime.now().getTime() + '@example.com', EmailEncodingKey = 'UTF-8',
            LastName = 'Sys', LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US',
            ProfileId = sysAdminProfile.Id, TimeZoneSidKey = 'America/Los_Angeles', UserName = 'sysadmin' + DateTime.now().getTime() + '@example.com'
        );
        insert sysAdmin;

        // 2. Create Standard User Profile/User
        Profile p = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        User u = new User(
            Alias = 'tstusr', Email = 'testuser' + DateTime.now().getTime() + '@example.com', EmailEncodingKey = 'UTF-8',
            LastName = 'TestUser', LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US',
            ProfileId = p.Id, TimeZoneSidKey = 'America/Los_Angeles', UserName = 'testuser' + DateTime.now().getTime() + '@example.com'
        );
        insert u;
        
        // Re-query the user immediately after insert to ensure the system-generated 'Name' field is populated.
        u = [SELECT Id, Name FROM User WHERE Id = :u.Id];

        System.runAs(u) {
            // 4. Create Job
            wfrecon__Job__c job = new wfrecon__Job__c();
            job.wfrecon__Job_Name__c = 'Test Project Alpha';
            insert job;
            Id jobId = job.Id;
            
            // 5. Create Location record (wfrecon__Location__c)
            SObject location = Schema.getGlobalDescribe().get(LOCATION_API).newSObject();
            location.put('wfrecon__Job__c', jobId);
            location.put('wfrecon__Quantity__c', 230);
            location.put('wfrecon__Unit_of_Measure__c', 'Square Footage');
            insert location;
            Id locationId = (Id) location.get('Id');

            // 6. Create wfrecon__Scope_Entry__c
            SObject scopeEntry = Schema.getGlobalDescribe().get(SCOPE_ENTRY_API).newSObject();
            scopeEntry.put('wfrecon__Job__c', jobId);
            insert scopeEntry;
            Id scopeEntryId = (Id) scopeEntry.get('Id');

            // 7. Create Cost Code record (wfrecon__Cost_Code__c)
            SObject costCode = Schema.getGlobalDescribe().get(COST_CODE_API).newSObject();
            insert costCode;
            Id costCodeId = (Id) costCode.get('Id');

            // 8. Create Location Process and Scope Process
            Scope_Entry_Process__c scopeProcess = new Scope_Entry_Process__c(
                Process_Name__c = 'Foundation Digging',
                wfrecon__Scope_Entry__c = scopeEntryId 
            );
            insert scopeProcess;
            Id scopeProcessId = scopeProcess.Id;

            Location_Process__c locationProcess = new Location_Process__c(
                Scope_Entry_Process__c = scopeProcessId, 
                Location__c = locationId, 
                Completed_Percentage__c = 50
            );
            insert locationProcess;
            Id locationProcessId = locationProcess.Id;

            // Create proper approval data JSON structure for location processes
            Map<String, Object> locationProcessChange = new Map<String, Object>{
                'id' => locationProcessId,
                'name' => 'Foundation Digging',
                'oldValue' => 50,
                'newValue' => 75
            };
            
            Map<String, Object> approvalDataMap = new Map<String, Object>{
                'locationProcessChanges' => new List<Object>{locationProcessChange}
            };
            
            String locationApprovalData = JSON.serialize(approvalDataMap);

            // 9. Create Log Entries
            wfrecon__Log_Entry__c logEntry = new wfrecon__Log_Entry__c(
                wfrecon__Job__c = jobId,
                wfrecon__Status__c = 'Pending',
                wfrecon__Work_Performed_Date__c = Date.today(),
                wfrecon__Approval_Data__c = locationApprovalData,
                wfrecon__Work_Performed__c = 'Finished Phase 1',
                wfrecon__Log_Type__c = 'Shift End'
            );
            insert logEntry;
            Id logEntryId = logEntry.Id;

            wfrecon__Log_Entry__c oldLogEntry = new wfrecon__Log_Entry__c(
                wfrecon__Job__c = jobId,
                wfrecon__Status__c = 'Auto-Approved',
                wfrecon__Work_Performed_Date__c = Date.today().addDays(-45),
                wfrecon__Log_Type__c = 'Shift End'
            );
            insert oldLogEntry;

            // 10. Create Timesheet Entry
            Contact c = new Contact(LastName = 'Worker', FirstName = 'Test');
            insert c;

            TimeSheet__c timesheet = new TimeSheet__c(Job__c = jobId, Contact__c = c.Id);
            insert timesheet;

            // Create proper timesheet entry changes structure
            Map<String, Object> tsChange = new Map<String, Object>{
                'fieldApiName' => 'Clock_In_Time__c',
                'oldValue' => DateTime.now().addHours(-8).format(),
                'newValue' => DateTime.now().addHours(-9).format()
            };
            
            Map<String, Object> tsEntryChange = new Map<String, Object>{
                'contactName' => 'Test Worker',
                'changes' => new List<Object>{tsChange}
            };

            Timesheet_Entry__c timesheetEntry = new Timesheet_Entry__c(
                TimeSheet__c = timesheet.Id,
                Status__c = 'Pending',
                wfrecon__Status__c = 'Pending',
                Clock_In_Time__c = DateTime.now().addHours(-8)
            );
            insert timesheetEntry;
            
            // Update with approval data after insert to get ID
            timesheetEntry.Approval_Data__c = JSON.serialize(new Map<String, Object>{
                'timesheetEntryChanges' => new Map<String, Object>{
                    timesheetEntry.Id => tsEntryChange
                }
            });
            update timesheetEntry;

            Timesheet_Entry_Item__c timesheetItem = new Timesheet_Entry_Item__c(
                wfrecon__Timesheet_Entry__c = timesheetEntry.Id,
                Status__c = 'Pending',
                Cost_Code__c = costCodeId, 
                Clock_In_Time__c = DateTime.now().addHours(-8)
            );
            insert timesheetItem;

            // 11. Create Content Document (Attachment)
            String docTitle = 'Test Document ' + System.currentTimeMillis();
            ContentVersion cv = new ContentVersion(
                Title = docTitle,
                PathOnClient = 'test.pdf',
                VersionData = Blob.valueOf('Test Content'),
                IsMajorVersion = true
            );
            insert cv;

            // Query ContentDocument
            List<ContentDocument> docs = [SELECT Id FROM ContentDocument WHERE Id = :cv.ContentDocumentId LIMIT 1];
            
            if (!docs.isEmpty()) {
                ContentDocumentLink cdl = new ContentDocumentLink(
                    ContentDocumentId = docs[0].Id,
                    LinkedEntityId = logEntryId,
                    ShareType = 'V'
                );
                insert cdl;
            }
        }
    }

    // --- Access Control Tests ---
    
    /**
     * @description: Test coverage for checkUserAccess method.
     */
    @IsTest
    static void testCheckUserAccess() {
        User sysAdminUser = [SELECT Id, Name FROM User WHERE Alias = 'sysadm' LIMIT 1];
        User standardUser = [SELECT Id, Name FROM User WHERE Alias = 'tstusr' LIMIT 1];
        
        Test.startTest();
        
        // 1. Test System Administrator access (should always pass)
        System.runAs(sysAdminUser) {
            Boolean isAdminAccess = ApproveShiftEndLogsController.checkUserAccess();
            System.assert(isAdminAccess, 'System Administrator should have access.');
        }

        // 2. Test user with no access (Standard User without metadata entry)
        System.runAs(standardUser) {
            Boolean hasAccess = ApproveShiftEndLogsController.checkUserAccess();
            // Without custom metadata, standard user won't have access
            System.assert(!hasAccess, 'Standard user without metadata should not have access.');
        }
        
        Test.stopTest();
    }

    // --- Data Retrieval Tests ---

    /**
     * @description: Test coverage for getUnapprovedLogEntries with all filters.
     */
    @IsTest
    static void testGetUnapprovedLogEntries() {
        User testUser = [SELECT Id FROM User WHERE Alias = 'tstusr' LIMIT 1];
        
        System.runAs(testUser) {
            Test.startTest();
            
            List<ApproveShiftEndLogsController.LogEntryWrapper> logs7 = 
                ApproveShiftEndLogsController.getUnapprovedLogEntries('last7days');
            System.assertEquals(1, logs7.size(), 'Should return one log entry from the last 7 days.');

            List<ApproveShiftEndLogsController.LogEntryWrapper> logsAll = 
                ApproveShiftEndLogsController.getUnapprovedLogEntries('alltime');
            System.assertEquals(2, logsAll.size(), 'Should return both log entries.');

            // Test with null filter - controller returns empty list, not exception
            List<ApproveShiftEndLogsController.LogEntryWrapper> logsNull = 
                ApproveShiftEndLogsController.getUnapprovedLogEntries(null);
            System.assertNotEquals(null, logsNull, 'Should return empty list for null filter.');
            
            Test.stopTest();
        }
    }

    /**
     * @description: Test coverage for getLogEntryDetails.
     */
    @IsTest
    static void testGetLogEntryDetails() {
        User testUser = [SELECT Id FROM User WHERE Alias = 'tstusr' LIMIT 1];
        wfrecon__Log_Entry__c logEntry = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        Id logEntryId = logEntry.Id;
        
        System.runAs(testUser) {
            Test.startTest();
            ApproveShiftEndLogsController.LogEntryDetails details = 
                ApproveShiftEndLogsController.getLogEntryDetails(logEntryId);
            Test.stopTest();
        }
    }

    /**
     * @description: Test coverage for deleteContentDocument and implicit isImageFile coverage.
     */
    @IsTest
    static void testDeleteContentDocumentAndImageHelper() {
        User testUser = [SELECT Id FROM User WHERE Alias = 'tstusr' LIMIT 1];
        
        System.runAs(testUser) {
            Test.startTest();
            
            // Query ContentDocument
            List<ContentDocument> docs = [SELECT Id FROM ContentDocument LIMIT 1];
            
            if (!docs.isEmpty()) {
                Id docId = docs[0].Id;
                
                // Implicit coverage of isImageFile through getLogEntryDetails
                wfrecon__Log_Entry__c logEntry = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
                ApproveShiftEndLogsController.LogEntryDetails details = 
                    ApproveShiftEndLogsController.getLogEntryDetails(logEntry.Id);

                // Test deleteContentDocument
                ApproveShiftEndLogsController.deleteContentDocument(docId);
                
            }
            
            Test.stopTest();
        }
    }

    // --- Approval Process Tests ---

    /**
     * @description: Test coverage for processLogEntryApproval, covering all internal private methods.
     */
    @IsTest
    static void testProcessLogEntryApproval() {
        User testUser = [SELECT Id FROM User WHERE Alias = 'tstusr' LIMIT 1];
        
        wfrecon__Log_Entry__c logEntry = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        Id logEntryId = logEntry.Id;
        Location_Process__c locationProcess = [SELECT Id FROM Location_Process__c LIMIT 1];
        Id lpId = locationProcess.Id;
        Timesheet_Entry__c tsEntry = [SELECT Id FROM Timesheet_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        Id tsEntryId = tsEntry.Id;
        Timesheet_Entry_Item__c tsItem = [SELECT Id FROM Timesheet_Entry_Item__c WHERE Status__c = 'Pending' LIMIT 1];
        Id tsItemId = tsItem.Id;
        List<ContentDocument> docs = [SELECT Id FROM ContentDocument LIMIT 1];
        Id cdId = !docs.isEmpty() ? docs[0].Id : null;

        System.runAs(testUser) {
            Test.startTest();
            
            // --- 1. Timesheet Approval Data ---
            Map<String, Object> tsFieldUpdates = new Map<String, Object>{
                'Clock_In_Time__c' => '2024-01-01T08:00:00',
                'Clock_Out_Time__c' => '2024-01-01T17:00:00',
                'Travel_Time__c' => 0.5
            };

            Map<String, Object> tsMap = new Map<String, Object>{
                'id' => tsEntryId,
                'fieldUpdates' => tsFieldUpdates
            };

            // --- 2. Location Process Approval Data ---
            Map<String, Object> lpApprove = new Map<String, Object>{
                'id' => lpId,
                'status' => 'Approved',
                'newValue' => 85
            };

            // --- 3. Full Approval Data ---
            Map<String, Object> fullApprovalData = new Map<String, Object>{
                'timesheets' => new List<Object>{tsMap},
                'locationProcesses' => new List<Object>{lpApprove}
            };
            
            if (cdId != null) {
                fullApprovalData.put('removedAttachments', new List<Object>{cdId});
            }

            Map<String, Object> logEntryUpdates = new Map<String, Object>{
                'workPerformed' => 'Updated work',
                'notesToOffice' => 'Updated notes'
            };

            String finalApprovalData = JSON.serialize(fullApprovalData);
            String finalLogEntryUpdates = JSON.serialize(logEntryUpdates);
            
            ApproveShiftEndLogsController.processLogEntryApproval(
                logEntryId, finalApprovalData, 'Approved', finalLogEntryUpdates
            );
            
            Test.stopTest();

        }
    }
    
    /**
     * @description: Test error handling in processLogEntryApproval
     */
    @IsTest
    static void testProcessLogEntryApprovalErrorHandling() {
        User testUser = [SELECT Id FROM User WHERE Alias = 'tstusr' LIMIT 1];
        
        wfrecon__Log_Entry__c logEntry = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        Id logEntryId = logEntry.Id;
        Timesheet_Entry__c tsEntry = [SELECT Id FROM Timesheet_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        Id tsEntryId = tsEntry.Id;

        System.runAs(testUser) {
            Test.startTest();
            
            // Invalid DateTime format to trigger error
            Map<String, Object> errorUpdates = new Map<String, Object>{
                'timesheets' => new List<Object>{
                    new Map<String, Object>{
                        'id' => tsEntryId,
                        'fieldUpdates' => new Map<String, Object>{
                            'Clock_In_Time__c' => 'INVALID_DATETIME'
                        }
                    }
                }
            };
            
            String errorApprovalData = JSON.serialize(errorUpdates);
            String errorLogEntryUpdates = JSON.serialize(new Map<String, Object>());

            // This should not throw exception - error is caught and logged
            ApproveShiftEndLogsController.processLogEntryApproval(
                logEntryId, errorApprovalData, 'Pending', errorLogEntryUpdates
            );
            
            Test.stopTest();
            
            // Log entry should remain unchanged due to error
            wfrecon__Log_Entry__c unchangedLog = [SELECT wfrecon__Status__c FROM wfrecon__Log_Entry__c WHERE Id = :logEntryId];
            System.assertEquals('Pending', unchangedLog.wfrecon__Status__c, 'Status should remain Pending after error.');
        }
    }
}