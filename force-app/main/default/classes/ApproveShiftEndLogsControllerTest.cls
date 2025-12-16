@IsTest
private class ApproveShiftEndLogsControllerTest {

    @TestSetup
    static void setupTestData() {
        // Create users
        Profile sysAdminProfile = [SELECT Id FROM Profile WHERE Name = 'System Administrator' LIMIT 1];
        User sysAdmin = new User(
            Alias = 'sysadm', Email = 'sysadmin@testorg.com',
            EmailEncodingKey = 'UTF-8', LastName = 'SysAdmin', LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US', ProfileId = sysAdminProfile.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'sysadmin@testorg.com' + System.currentTimeMillis()
        );
        insert sysAdmin;

        Profile stdProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        User stdUser = new User(
            Alias = 'tstusr', Email = 'testuser@testorg.com',
            EmailEncodingKey = 'UTF-8', LastName = 'TestUser', LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US', ProfileId = stdProfile.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'testuser@testorg.com' + System.currentTimeMillis()
        );
        insert stdUser;

        System.runAs(stdUser) {
            // Job
            wfrecon__Job__c job = new wfrecon__Job__c(
                wfrecon__Job_Name__c = 'Test Project Alpha'
            );
            insert job;

            // Location + Scope + Process
            wfrecon__Location__c loc = new wfrecon__Location__c(wfrecon__Job__c = job.Id);
            insert loc;

            wfrecon__Scope_Entry__c scope = new wfrecon__Scope_Entry__c(wfrecon__Job__c = job.Id);
            insert scope;

            Scope_Entry_Process__c proc = new Scope_Entry_Process__c(
                Process_Name__c = 'Foundation',
                wfrecon__Scope_Entry__c = scope.Id
            );
            insert proc;

            Location_Process__c lp = new Location_Process__c(
                Scope_Entry_Process__c = proc.Id,
                Location__c = loc.Id,
                Completed_Percentage__c = 40
            );
            insert lp;

            // Cost Code
            wfrecon__Cost_Code__c cc = new wfrecon__Cost_Code__c(Name = '1000');
            insert cc;

            // Timesheet
            Contact c = new Contact(LastName = 'Worker');
            insert c;

            TimeSheet__c tsHeader = new TimeSheet__c(Job__c = job.Id, Contact__c = c.Id);
            insert tsHeader;

            Timesheet_Entry__c tsEntry = new Timesheet_Entry__c(
                TimeSheet__c = tsHeader.Id,
                wfrecon__Status__c = 'Pending',
                Clock_In_Time__c = DateTime.now()
            );
            insert tsEntry;

            Timesheet_Entry_Item__c tsItem = new Timesheet_Entry_Item__c(
                wfrecon__Timesheet_Entry__c = tsEntry.Id,
                wfrecon__Status__c = 'Pending',
                Cost_Code__c = cc.Id
            );
            insert tsItem;

            // Approval JSON
            Map<String, Object> approvalData = new Map<String, Object>{
                'locationProcessChanges' => new List<Object>{
                    new Map<String, Object>{ 'id' => lp.Id, 'name' => 'Foundation', 'oldValue' => 40, 'newValue' => 75 }
                },
                'timesheetEntryChanges' => new Map<String, Object>{
                    String.valueOf(tsEntry.Id) => new Map<String, Object>{
                        'contactName' => 'John Worker',
                        'changes' => new List<Object>{
                            new Map<String, Object>{
                                'fieldApiName' => 'wfrecon__Clock_In_Time__c',
                                'oldValue' => '2025-11-20 08:00:00',
                                'newValue' => '2025-11-20 07:30:00'
                            }
                        }
                    }
                }
            };

            // Log Entry
            wfrecon__Log_Entry__c log = new wfrecon__Log_Entry__c(
                wfrecon__Job__c = job.Id,
                wfrecon__Status__c = 'Pending',
                wfrecon__Work_Performed_Date__c = Date.today(),
                wfrecon__Approval_Data__c = JSON.serialize(approvalData),
                wfrecon__Log_Type__c = 'Shift End'
            );
            insert log;

            // Attachment
            ContentVersion cv = new ContentVersion(
                Title = 'Test Photo',
                PathOnClient = 'photo.jpg',
                VersionData = Blob.valueOf('test'),
                IsMajorVersion = true
            );
            insert cv;

            // Link to log
            ContentVersion cvq = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id];
            ContentDocumentLink cdl = new ContentDocumentLink(
                ContentDocumentId = cvq.ContentDocumentId,
                LinkedEntityId = log.Id,
                ShareType = 'V'
            );
            insert cdl;
        }
    }

    // FIXED: Query ContentDocument properly
    // private static ContentDocument getTestContentDocument() {
    //     LIST<ContentVersion> cv = [SELECT ContentDocumentId FROM ContentVersion WHERE Title = 'Test Photo' LIMIT 1];
    //     return [SELECT Id FROM ContentDocument WHERE Id = :cv[0].ContentDocumentId];
    // }

    @IsTest
    static void testCheckUserAccess_SystemAdmin() {
        User admin = [SELECT Id FROM User WHERE Alias = 'sysadm' LIMIT 1];
        System.runAs(admin) {
            Map<String, Boolean> result = ApproveShiftEndLogsController.checkUserAccess();
            System.assertEquals(true, result.get('hasAccess'), 'System Admin should have access');
            System.assertEquals(false, result.get('timesheetApprovalEnabled'));
        }
    }

    @IsTest
    static void testCheckUserAccess_NoAccess() {
        User u = [SELECT Id FROM User WHERE Alias = 'tstusr' LIMIT 1];
        System.runAs(u) {
            Map<String, Boolean> result = ApproveShiftEndLogsController.checkUserAccess();
            System.assertEquals(false, result.get('hasAccess'), 'Normal user should not have access');
            System.assertEquals(false, result.get('timesheetApprovalEnabled'));
        }
    }

    @IsTest
    static void testGetUnapprovedLogEntries_AllFilters() {
        User u = [SELECT Id FROM User WHERE Alias = 'sysadm' LIMIT 1]; // Use admin to avoid access issues
        System.runAs(u) {
            Test.startTest();
            System.assert(ApproveShiftEndLogsController.getUnapprovedLogEntries('last7days').entries.size() > 0);
            System.assertNotEquals(null, ApproveShiftEndLogsController.getUnapprovedLogEntries('last15days'));
            System.assertNotEquals(null, ApproveShiftEndLogsController.getUnapprovedLogEntries('last30days'));
            System.assertNotEquals(null, ApproveShiftEndLogsController.getUnapprovedLogEntries('alltime'));
            System.assertNotEquals(null, ApproveShiftEndLogsController.getUnapprovedLogEntries(null));
            Test.stopTest();
        }
    }

    @IsTest
    static void testGetLogEntryDetails() {
        User u = [SELECT Id FROM User WHERE Alias = 'sysadm' LIMIT 1];
        wfrecon__Log_Entry__c log = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];

        System.runAs(u) {
            ApproveShiftEndLogsController.LogEntryDetails d = ApproveShiftEndLogsController.getLogEntryDetails(log.Id);
            System.assertNotEquals(null, d);
            System.assertNotEquals(null, d.attachments);
            System.assert(d.attachments.size() > 0);
            System.assert(d.attachments[0].isImage);
        }
    }

    @IsTest
    static void testConvertUtc_VariousFormats() {
        System.assertNotEquals(null, ApproveShiftEndLogsController.convertUtc('2025-11-28T14:30:00'));
        System.assertNotEquals(null, ApproveShiftEndLogsController.convertUtc('2025-11-28T14:30'));
        System.assertNotEquals(null, ApproveShiftEndLogsController.convertUtc('2025-11-28 14:30'));
        System.assertEquals(null, ApproveShiftEndLogsController.convertUtc('invalid'));
    }

    @IsTest
    static void testProcessLogEntryApproval_FullApproval() {
        User u = [SELECT Id FROM User WHERE Alias = 'sysadm' LIMIT 1];
        wfrecon__Log_Entry__c log = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        Timesheet_Entry__c ts = [SELECT Id FROM Timesheet_Entry__c LIMIT 1];
        Location_Process__c lp = [SELECT Id FROM Location_Process__c LIMIT 1];

        Map<String, Object> payload = new Map<String, Object>{
            'timesheets' => new List<Object>{ new Map<String, Object>{
                'id' => ts.Id, 'status' => 'Approved',
                'fieldUpdates' => new Map<String, Object>{
                    'wfrecon__Clock_In_Time__c' => '2025-01-01T08:00:00'
                }
            }},
            'locationProcesses' => new List<Object>{ new Map<String, Object>{
                'id' => lp.Id, 'status' => 'Approved', 'newValue' => 100
            }}
        };

        System.runAs(u) {
            Test.startTest();
            ApproveShiftEndLogsController.processLogEntryApproval(
                log.Id, JSON.serialize(payload), 'Approved', '{}'
            );
            Test.stopTest();
        }

        System.assertEquals('Approved', [SELECT wfrecon__Status__c FROM wfrecon__Log_Entry__c WHERE Id = :log.Id].wfrecon__Status__c);
        System.assertEquals(100, [SELECT Completed_Percentage__c FROM Location_Process__c WHERE Id = :lp.Id].Completed_Percentage__c);
    }

    @IsTest
    static void testProcessLogEntryApproval_Rejection() {
        User u = [SELECT Id FROM User WHERE Alias = 'sysadm' LIMIT 1];
        wfrecon__Log_Entry__c log = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        Timesheet_Entry__c ts = [SELECT Id FROM Timesheet_Entry__c LIMIT 1];
        
        ContentVersion contentVersionInsert = new ContentVersion(
            Title = 'Test',
            PathOnClient = 'Test.jpg',
            VersionData = Blob.valueOf('Test Content Data'),
            IsMajorVersion = true
        );
        insert contentVersionInsert;
 
        ContentVersion contentVersionSelect = [SELECT Id, Title, ContentDocumentId FROM ContentVersion WHERE Id = :contentVersionInsert.Id LIMIT 1];

        Map<String, Object> payload = new Map<String, Object>{
            'timesheets' => new List<Object>{ new Map<String, Object>{ 'id' => ts.Id, 'status' => 'Rejected' }}
        };
       
        Map<String, Object> payload1 = new Map<String, Object>{           
            'removedAttachments' => new List<Object>{ new Map<String, Object>{
                'id' => contentVersionSelect.ContentDocumentId
            }}
        };     
            

        System.runAs(u) {
            Test.startTest();
            ApproveShiftEndLogsController.processLogEntryApproval(log.Id, JSON.serialize(payload), 'Rejected', '{}');
            ApproveShiftEndLogsController.processLogEntryApproval(log.Id, JSON.serialize(payload1), 'Approved', '{}');
            Test.stopTest();
        }

        System.assertEquals('Rejected', [SELECT wfrecon__Status__c FROM wfrecon__Log_Entry__c WHERE Id = :log.Id].wfrecon__Status__c);
    }

    @IsTest
    static void testProcessLogEntryApproval_ErrorHandling() {
        User u = [SELECT Id FROM User WHERE Alias = 'sysadm' LIMIT 1];
        wfrecon__Log_Entry__c log = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        Timesheet_Entry__c ts = [SELECT Id FROM Timesheet_Entry__c LIMIT 1];

        Map<String, Object> bad = new Map<String, Object>{
            'timesheets' => new List<Object>{ new Map<String, Object>{
                'id' => ts.Id, 'status' => 'Approved',
                'fieldUpdates' => new Map<String, Object>{ 'wfrecon__Clock_In_Time__c' => 'BAD' }
            }}
        };

        System.runAs(u) {
            Test.startTest();
            ApproveShiftEndLogsController.processLogEntryApproval(log.Id, JSON.serialize(bad), 'Approved', '{}');
            Test.stopTest();
        }
        // Should not crash
        System.assert(true);
    }
    
     @IsTest
    static void testdeleteContentDocument() {
        User admin = [SELECT Id FROM User WHERE Alias = 'sysadm' LIMIT 1];
        System.runAs(admin) {
            
            ContentVersion contentVersionInsert = new ContentVersion(
            Title = 'Test',
            PathOnClient = 'Test.jpg',
            VersionData = Blob.valueOf('Test Content Data'),
            IsMajorVersion = true
            );
            insert contentVersionInsert;
 
        	ContentVersion contentVersionSelect = [SELECT Id, Title, ContentDocumentId FROM ContentVersion WHERE Id = :contentVersionInsert.Id LIMIT 1];

            ApproveShiftEndLogsController.deleteContentDocument(contentVersionSelect.ContentDocumentId);
            
        }
    }
    
    @IsTest
    static void testsaveCameraPhoto() {
        User admin = [SELECT Id FROM User WHERE Alias = 'sysadm' LIMIT 1];
        wfrecon__Log_Entry__c log = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        
        System.runAs(admin) {
                       
            ApproveShiftEndLogsController.saveCameraPhoto(log.Id,'testfile.jpg','testbase64');
        }
    }
    
    @IsTest
    static void testlinkChatterFiles() {
        User admin = [SELECT Id FROM User WHERE Alias = 'sysadm' LIMIT 1];
        wfrecon__Log_Entry__c log = [SELECT Id FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = 'Pending' LIMIT 1];
        
        System.runAs(admin) { 
            List<String> contentDocIds = new List<String>();

            ContentVersion contentVersionInsert = new ContentVersion(
                Title = 'Test',
                PathOnClient = 'Test.jpg',
                VersionData = Blob.valueOf('Test Content Data'),
                IsMajorVersion = true
            );
            insert contentVersionInsert;
            ContentVersion contentVersionSelect = [SELECT Id, Title, ContentDocumentId FROM ContentVersion WHERE Id = :contentVersionInsert.Id LIMIT 1];
            contentDocIds.add(contentVersionSelect.ContentDocumentId);
            	                       
            ApproveShiftEndLogsController.linkChatterFiles(log.Id,contentDocIds);
        }
    }
}