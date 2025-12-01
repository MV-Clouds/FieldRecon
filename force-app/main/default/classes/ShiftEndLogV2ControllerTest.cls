@isTest
private class ShiftEndLogV2ControllerTest {

    @testSetup
    static void setupData() {
        // ---------- BASIC DATA (same as before) ----------
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User' LIMIT 1];
        User testUser = new User(
            Alias = 'stdu', 
            Email = 'stduser@testorg.com',
            EmailEncodingKey = 'UTF-8', 
            LastName = 'Testing', 
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US', 
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles', 
            UserName = 'testuser' + DateTime.now().getTime() + '@testorg.com'
        );
        insert testUser;

        Contact c = new Contact(
            LastName = 'Testing',
            wfrecon__User__c = testUser.Id
        );
        insert c;

        wfrecon__Job__c job = new wfrecon__Job__c();
        insert job;

        wfrecon__Crew__c crew = new wfrecon__Crew__c(Name = 'Test Crew');
        insert crew;

        wfrecon__Mobilization__c mob = new wfrecon__Mobilization__c(wfrecon__Job__c = job.Id);
        insert mob;

        wfrecon__Mobilization_Member__c mobMember = new wfrecon__Mobilization_Member__c(
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Crew__c = crew.Id
        );
        insert mobMember;

        wfrecon__Crew_Member__c crewMember = new wfrecon__Crew_Member__c(
            wfrecon__Crew__c = crew.Id,
            wfrecon__Contact__c = c.Id,
            wfrecon__Member_Type__c = 'Leader'
        );
        insert crewMember;

        // ---------- LOCATION / PROCESS (for snapshots) ----------
        wfrecon__Scope_Entry__c scopeEntry = new wfrecon__Scope_Entry__c(wfrecon__Job__c = job.Id);
        insert scopeEntry;

        wfrecon__Scope_Entry_Process__c scopeProc = new wfrecon__Scope_Entry_Process__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Scope_Entry__c = scopeEntry.Id,
            wfrecon__Process_Name__c = 'Test Process',
            wfrecon__Sequence__c = 1,
            wfrecon__Weight__c = 1
        );
        insert scopeProc;

        wfrecon__Location__c loc = new wfrecon__Location__c(
            wfrecon__Job__c = job.Id,
            Name = 'Test Location'
        );
        insert loc;

        wfrecon__Location_Process__c locProc = new wfrecon__Location_Process__c(
            wfrecon__Location__c = loc.Id,
            wfrecon__Scope_Entry_Process__c = scopeProc.Id,
            wfrecon__Completed_Percentage__c = 65,
            wfrecon__Sequence__c = 2
        );
        insert locProc;

        // ---------- LOGS with different approval-data formats ----------
        // 1. New format (object with locationProcessChanges)
        String newFormat = '{"locationProcessChanges":[{"id":"' + locProc.Id + '","old":30,"new":65}],"mediaMetadata":[]}';
        wfrecon__Log_Entry__c logNew = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Work_Performed_Date__c = Date.today(),
            wfrecon__Approval_Data__c = newFormat
        );
        insert logNew;

        // 2. Old format (plain array)
        String oldFormat = '[{"id":"' + locProc.Id + '","oldValue":20,"newValue":45}]';
        wfrecon__Log_Entry__c logOld = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Work_Performed_Date__c = Date.today(),
            wfrecon__Approval_Data__c = oldFormat
        );
        insert logOld;

        // 3. Log with corrupted JSON (to hit the catch inside the loop)
        wfrecon__Log_Entry__c logBad = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Approval_Data__c = '{this is not json'
        );
        insert logBad;
    }

    // --- The rest of the test methods remain exactly the same ---

    @isTest
    static void testGetShiftEndLogsWithCrewInfo() {
        User testUser = [SELECT Id FROM User WHERE LastName = 'Testing' LIMIT 1];
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Log_Entry__c log = [SELECT Id FROM wfrecon__Log_Entry__c LIMIT 1];

        ContentVersion cv = new ContentVersion(
            Title = 'Test Image',
            PathOnClient = 'TestImage.jpg',
            VersionData = Blob.valueOf('Test Content'),
            FirstPublishLocationId = log.Id 
        );
        insert cv;

        Test.startTest();
            ShiftEndLogV2Controller.ShiftEndLogWithCrewWrapper result = 
                ShiftEndLogV2Controller.getShiftEndLogsWithCrewInfo(job.Id);

            System.assertNotEquals(null, result.crewInfo, 'Crew info should not be null');
        Test.stopTest();
    }

    @isTest
    static void testGetShiftEndLogs_NoJob() {
        Test.startTest();
            ShiftEndLogV2Controller.ShiftEndLogWithCrewWrapper result = 
                ShiftEndLogV2Controller.getShiftEndLogsWithCrewInfo(null);
        Test.stopTest();

        System.assertNotEquals(null, result);
        System.assertEquals(0, result.shiftEndLogs.size());
    }

    @isTest
    static void testUpdateShiftEndLogWithImages() {
        wfrecon__Log_Entry__c log = [SELECT Id, wfrecon__Approval_Data__c FROM wfrecon__Log_Entry__c LIMIT 1];
        
        ContentVersion cvDelete = new ContentVersion(Title = 'DeleteMe', PathOnClient = 'DeleteMe.jpg', VersionData = Blob.valueOf('A'), FirstPublishLocationId = log.Id);
        insert cvDelete;
        Id docIdToDelete = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cvDelete.Id].ContentDocumentId;

        ContentVersion cvUnlink = new ContentVersion(Title = 'UnlinkMe', PathOnClient = 'UnlinkMe.jpg', VersionData = Blob.valueOf('B'), FirstPublishLocationId = log.Id);
        insert cvUnlink;
        Id docIdToUnlink = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cvUnlink.Id].ContentDocumentId;

        ContentVersion cvLink = new ContentVersion(Title = 'LinkMe', PathOnClient = 'LinkMe.jpg', VersionData = Blob.valueOf('C'));
        insert cvLink;
        Id docIdToLink = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cvLink.Id].ContentDocumentId;

        String cameraJson = '[{"fileName": "Camera1.jpg", "base64Data": "' + EncodingUtil.base64Encode(Blob.valueOf('CamData')) + '"}]';

        Test.startTest();
        List<String> deleteIds = new List<String>{String.valueOf(docIdToDelete)};
        List<String> unlinkIds = new List<String>{String.valueOf(docIdToUnlink)};
        List<String> linkIds = new List<String>{String.valueOf(docIdToLink)};

        ShiftEndLogV2Controller.updateShiftEndLogWithImages(log, deleteIds, unlinkIds, linkIds, cameraJson);
        Test.stopTest();

        List<ContentDocument> deletedDocs = [SELECT Id FROM ContentDocument WHERE Id = :docIdToDelete];
        System.assertEquals(0, deletedDocs.size(), 'Document should be deleted');

        List<ContentDocumentLink> unlinkedLinks = [SELECT Id FROM ContentDocumentLink WHERE ContentDocumentId = :docIdToUnlink AND LinkedEntityId = :log.Id];
        System.assertEquals(0, unlinkedLinks.size(), 'Link should be removed');
        
        List<ContentDocumentLink> newLinks = [SELECT Id FROM ContentDocumentLink WHERE ContentDocumentId = :docIdToLink AND LinkedEntityId = :log.Id];
        System.assertEquals(1, newLinks.size(), 'New link should be created');
    }

    @isTest
    static void testDeleteShiftEndLog() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Log_Entry__c log = new wfrecon__Log_Entry__c(wfrecon__Job__c = job.Id, wfrecon__Log_Type__c = 'Shift End');
        insert log;

        ContentVersion cvChatter = new ContentVersion(Title='ChatterFile', PathOnClient='C.jpg', VersionData=Blob.valueOf('C'), FirstPublishLocationId=log.Id);
        insert cvChatter;
        Id chatterDocId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cvChatter.Id].ContentDocumentId;

        ContentVersion cvCamera = new ContentVersion(Title='CameraFile', PathOnClient='Cam.jpg', VersionData=Blob.valueOf('Cam'), FirstPublishLocationId=log.Id);
        insert cvCamera;
        Id cameraDocId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cvCamera.Id].ContentDocumentId;

        Map<String, Object> metaItem = new Map<String, Object>();
        metaItem.put('source', 'chatter');
        metaItem.put('contentDocumentId', chatterDocId);
        Map<String, Object> approvalData = new Map<String, Object>();
        approvalData.put('mediaMetadata', new List<Object>{metaItem});
        
        log.wfrecon__Approval_Data__c = JSON.serialize(approvalData);
        update log;

        Test.startTest();
        String result = ShiftEndLogV2Controller.deleteShiftEndLog(log.Id);
        Test.stopTest();

        System.assertEquals('Success: Shift end log deleted successfully', result);
        List<ContentDocument> camFiles = [SELECT Id FROM ContentDocument WHERE Id = :cameraDocId];
        System.assertEquals(0, camFiles.size(), 'Camera file should be deleted');
        List<ContentDocument> chatFiles = [SELECT Id FROM ContentDocument WHERE Id = :chatterDocId];
        System.assertEquals(1, chatFiles.size(), 'Chatter file should remain');
    }

    @isTest
    static void testDeleteUploadedFiles() {
        ContentVersion cv = new ContentVersion(Title = 'Temp', PathOnClient = 'Temp.jpg', VersionData = Blob.valueOf('Data'));
        insert cv;
        Id docId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;

        Test.startTest();
        ShiftEndLogV2Controller.deleteUploadedFiles(new List<String>{String.valueOf(docId)});
        Test.stopTest();

        List<ContentDocument> docs = [SELECT Id FROM ContentDocument WHERE Id = :docId];
        System.assertEquals(0, docs.size());
    }

    @isTest
    static void testCheckOrgStorageLimit() {
        Test.startTest();
        Map<String, Object> result = ShiftEndLogV2Controller.checkOrgStorageLimit();
        Test.stopTest();
        System.assert(result.containsKey('hasSpace'));
    }

    @isTest
    static void testExceptions() {
        Boolean exceptionCaught = false;
        try {
            ShiftEndLogV2Controller.updateShiftEndLogWithImages(null, null, null, null, null);
        } catch (Exception e) {
            exceptionCaught = true;
        }
        System.assert(exceptionCaught);

        exceptionCaught = false;
        try {
            ShiftEndLogV2Controller.deleteShiftEndLog(null);
        } catch (Exception e) {
            exceptionCaught = true;
        }
        System.assert(exceptionCaught);
    }
}