/**
* Test Class Name: ProposalPageControllerTest
* @description: Test class for ProposalPageController
**/
@isTest
private class ProposalPageControllerTest {
    
    @testSetup
    static void setupTestData() {
        // Create Account
        Account acc = new Account();
        acc.Name = 'Test Account';
        insert acc;
        
        // Create Contact
        Contact con = new Contact();
        con.FirstName = 'Test';
        con.LastName = 'Contact';
        con.Email = 'test@example.com';
        con.AccountId = acc.Id;
        insert con;
        
        // Create Proposal
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        proposal.wfrecon__Expiration_Date__c = Date.today().addDays(30);
        insert proposal;
        
        // Create Proposal Recipient with Pending status
        wfrecon__Proposal_Recipient__c proRec = new wfrecon__Proposal_Recipient__c();
        proRec.wfrecon__Proposal__c = proposal.Id;
        proRec.wfrecon__Contact__c = con.Id;
        proRec.wfrecon__Status__c = 'Pending';
        insert proRec;
            
    }
    
    @isTest
    static void testCreatePDF_Success() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        // Set up page parameters
        PageReference pageRef = Page.ProposalPage;
        Test.setCurrentPage(pageRef);
        ApexPages.currentPage().getParameters().put('recordId', proposal.Id);
        ApexPages.currentPage().getParameters().put('templateId', template.Id);
        ApexPages.currentPage().getParameters().put('contactId', con.Id);
        
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.createPDF();
        Test.stopTest();
        
        System.assertEquals(false, controller.isAccepted, 'Should not be accepted');
        System.assertEquals(false, controller.isExpired, 'Should not be expired');
        System.assertEquals('Pending', controller.proposalStatus, 'Status should be Pending');
    }
    
    @isTest
    static void testCreatePDF_MissingRecordId() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        PageReference pageRef = Page.ProposalPage;
        Test.setCurrentPage(pageRef);
        ApexPages.currentPage().getParameters().put('templateId', template.Id);
        ApexPages.currentPage().getParameters().put('contactId', con.Id);
        
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.createPDF();
        Test.stopTest();
        
        System.assertEquals(null, controller.strBody, 'Email body should be null');
        System.assert(controller.quoteMessage.contains('Proposal ID is missing'), 'Should show error message');
    }
    
    @isTest
    static void testCreatePDF_MissingTemplateId() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        
        PageReference pageRef = Page.ProposalPage;
        Test.setCurrentPage(pageRef);
        ApexPages.currentPage().getParameters().put('recordId', proposal.Id);
        ApexPages.currentPage().getParameters().put('contactId', con.Id);
        
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.createPDF();
        Test.stopTest();
        
        System.assertEquals(null, controller.strBody, 'Email body should be null');
        System.assert(controller.quoteMessage.contains('Template ID is missing'), 'Should show error message');
    }
    
    @isTest
    static void testCreatePDF_MissingContactId() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        PageReference pageRef = Page.ProposalPage;
        Test.setCurrentPage(pageRef);
        ApexPages.currentPage().getParameters().put('recordId', proposal.Id);
        ApexPages.currentPage().getParameters().put('templateId', template.Id);
        
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.createPDF();
        Test.stopTest();
        
        System.assertEquals(null, controller.strBody, 'Email body should be null');
        System.assert(controller.quoteMessage.contains('Contact ID is missing'), 'Should show error message');
    }
    
    @isTest
    static void testCreatePDF_NoProposalRecipient() {
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;
        
        Contact newCon = new Contact();
        newCon.FirstName = 'New';
        newCon.LastName = 'Contact';
        newCon.Email = 'new@example.com';
        insert newCon;
        
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        PageReference pageRef = Page.ProposalPage;
        Test.setCurrentPage(pageRef);
        ApexPages.currentPage().getParameters().put('recordId', proposal.Id);
        ApexPages.currentPage().getParameters().put('templateId', template.Id);
        ApexPages.currentPage().getParameters().put('contactId', newCon.Id);
        
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.createPDF();
        Test.stopTest();
        
        System.assertEquals(null, controller.strBody, 'Email body should be null');
        System.assert(controller.quoteMessage.contains('No valid proposal found'), 'Should show error message');
    }
    
    @isTest
    static void testCreatePDF_AlreadyAccepted() {
        wfrecon__Proposal_Recipient__c proRec = [SELECT Id FROM wfrecon__Proposal_Recipient__c LIMIT 1];
        proRec.wfrecon__Status__c = 'Accepted';
        proRec.wfrecon__Accepted_Rejected_Changed_Date__c = Date.today();
        update proRec;
        
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        PageReference pageRef = Page.ProposalPage;
        Test.setCurrentPage(pageRef);
        ApexPages.currentPage().getParameters().put('recordId', proposal.Id);
        ApexPages.currentPage().getParameters().put('templateId', template.Id);
        ApexPages.currentPage().getParameters().put('contactId', con.Id);
        
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.createPDF();
        Test.stopTest();
        
        System.assertEquals(true, controller.isAccepted, 'Should be marked as accepted');
        System.assertEquals('Accepted', controller.proposalStatus, 'Status should be Accepted');
        System.assertEquals('Accepted', controller.result, 'Result should be Accepted');
        System.assert(controller.strBody.contains('Accepted'), 'Body should contain Accepted status');
    }
    
    @isTest
    static void testCreatePDF_AlreadyRejected() {
        wfrecon__Proposal_Recipient__c proRec = [SELECT Id FROM wfrecon__Proposal_Recipient__c LIMIT 1];
        proRec.wfrecon__Status__c = 'Rejected';
        update proRec;
        
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        PageReference pageRef = Page.ProposalPage;
        Test.setCurrentPage(pageRef);
        ApexPages.currentPage().getParameters().put('recordId', proposal.Id);
        ApexPages.currentPage().getParameters().put('templateId', template.Id);
        ApexPages.currentPage().getParameters().put('contactId', con.Id);
        
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.createPDF();
        Test.stopTest();
        
        System.assertEquals('Rejected', controller.proposalStatus, 'Status should be Rejected');
        System.assertEquals('Rejected', controller.result, 'Result should be Rejected');
        System.assert(controller.strBody.contains('Rejected'), 'Body should contain Rejected status');
    }
    
    @isTest
    static void testCreatePDF_ChangesRequested() {
        wfrecon__Proposal_Recipient__c proRec = [SELECT Id FROM wfrecon__Proposal_Recipient__c LIMIT 1];
        proRec.wfrecon__Status__c = 'Changes Requested';
        update proRec;
        
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        PageReference pageRef = Page.ProposalPage;
        Test.setCurrentPage(pageRef);
        ApexPages.currentPage().getParameters().put('recordId', proposal.Id);
        ApexPages.currentPage().getParameters().put('templateId', template.Id);
        ApexPages.currentPage().getParameters().put('contactId', con.Id);
        
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.createPDF();
        Test.stopTest();
        
        System.assertEquals('Changes Requested', controller.proposalStatus, 'Status should be Changes Requested');
        System.assertEquals('Changes Requested', controller.result, 'Result should be Changes Requested');
        System.assert(controller.strBody.contains('Changes Requested'), 'Body should contain Changes Requested status');
    }
    
    @isTest
    static void testCreatePDF_Expired() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        proposal.wfrecon__Expiration_Date__c = Date.today().addDays(-1);
        update proposal;
        
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        PageReference pageRef = Page.ProposalPage;
        Test.setCurrentPage(pageRef);
        ApexPages.currentPage().getParameters().put('recordId', proposal.Id);
        ApexPages.currentPage().getParameters().put('templateId', template.Id);
        ApexPages.currentPage().getParameters().put('contactId', con.Id);
        
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.createPDF();
        Test.stopTest();
        
        System.assertEquals(true, controller.isExpired, 'Should be marked as expired');
        System.assertEquals('Expired', controller.proposalStatus, 'Status should be Expired');
        System.assertEquals('Expired', controller.result, 'Result should be Expired');
        System.assert(controller.strBody.contains('Expired'), 'Body should contain Expired status');
    }
    
    @isTest
    static void testShowRejectReasonPopup() {
        ProposalPageController controller = new ProposalPageController();
        
        Test.startTest();
        controller.showRejectReasonPopup();
        Test.stopTest();
        
        System.assertEquals(true, controller.displayPopup, 'Popup should be displayed');
    }
    
    @isTest
    static void testCloseRejectReason() {
        ProposalPageController controller = new ProposalPageController();
        controller.displayPopup = true;
        
        Test.startTest();
        controller.closeRejectReason();
        Test.stopTest();
        
        System.assertEquals(false, controller.displayPopup, 'Popup should be closed');
    }
    
    @isTest
    static void testSaveRejectionReason_Success() {
        wfrecon__Proposal_Recipient__c proRec = [SELECT Id FROM wfrecon__Proposal_Recipient__c LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id, Name FROM wfrecon__Proposal__c LIMIT 1];
        
        ProposalPageController controller = new ProposalPageController();
        controller.proposalRecipientId = proRec.Id;
        controller.proRecRecord = new wfrecon__Proposal_Recipient__c();
        controller.proRecRecord.wfrecon__Proposal__r = proposal;
        controller.rejectionReason = 'Test rejection reason';
        controller.displayPopup = true;
        
        Test.startTest();
        controller.saveRejectionReason();
        Test.stopTest();
        
        System.assertEquals(false, controller.displayPopup, 'Popup should be closed');
        System.assertEquals('Rejected', controller.proposalStatus, 'Status should be Rejected');
        System.assertEquals('Rejected', controller.result, 'Result should be Rejected');
        System.assertEquals(true, controller.customSignature, 'Custom signature should be true');
        
        // Verify proposal recipient was updated
        wfrecon__Proposal_Recipient__c updatedRec = [
            SELECT Id, wfrecon__Status__c, wfrecon__Requested_Changes__c, 
                   wfrecon__Accepted_Rejected_Changed_Date__c
            FROM wfrecon__Proposal_Recipient__c
            WHERE Id = :proRec.Id
        ];
        System.assertEquals('Rejected', updatedRec.wfrecon__Status__c, 'Status should be Rejected');
        System.assertEquals('Test rejection reason', updatedRec.wfrecon__Requested_Changes__c, 'Rejection reason should be saved');
        System.assertNotEquals(null, updatedRec.wfrecon__Accepted_Rejected_Changed_Date__c, 'Date should be set');
    }
    
    @isTest
    static void testSaveRejectionReason_Exception() {
        ProposalPageController controller = new ProposalPageController();
        controller.proposalRecipientId = 'invalidId';
        controller.proRecRecord = new wfrecon__Proposal_Recipient__c();
        controller.rejectionReason = 'Test rejection reason';
        
        Test.startTest();
        controller.saveRejectionReason();
        Test.stopTest();
        
        System.assert(controller.quoteMessage.contains('Error saving rejection'), 'Should show error message');
        System.assertEquals(null, controller.strBody, 'Body should be null');
    }
    
    @isTest
    static void testSaveRequestChanges_Success() {
        wfrecon__Proposal_Recipient__c proRec = [SELECT Id FROM wfrecon__Proposal_Recipient__c LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id, Name FROM wfrecon__Proposal__c LIMIT 1];
        
        ProposalPageController controller = new ProposalPageController();
        controller.proposalRecipientId = proRec.Id;
        controller.proRecRecord = new wfrecon__Proposal_Recipient__c();
        controller.proRecRecord.wfrecon__Proposal__r = proposal;
        controller.requestedChanges = 'Please update pricing';
        controller.displayPopup = true;
        
        Test.startTest();
        controller.saveRequestChanges();
        Test.stopTest();
        
        System.assertEquals(false, controller.displayPopup, 'Popup should be closed');
        System.assertEquals('Changes Requested', controller.proposalStatus, 'Status should be Changes Requested');
        System.assertEquals('Changes Requested', controller.result, 'Result should be Changes Requested');
        System.assertEquals(true, controller.customSignature, 'Custom signature should be true');
        
        // Verify proposal recipient was updated
        wfrecon__Proposal_Recipient__c updatedRec = [
            SELECT Id, wfrecon__Status__c, wfrecon__Requested_Changes__c, 
                   wfrecon__Accepted_Rejected_Changed_Date__c
            FROM wfrecon__Proposal_Recipient__c
            WHERE Id = :proRec.Id
        ];
        System.assertEquals('Changes Requested', updatedRec.wfrecon__Status__c, 'Status should be Changes Requested');
        System.assertEquals('Please update pricing', updatedRec.wfrecon__Requested_Changes__c, 'Requested changes should be saved');
        System.assertNotEquals(null, updatedRec.wfrecon__Accepted_Rejected_Changed_Date__c, 'Date should be set');
    }
    
    @isTest
    static void testSaveRequestChanges_BlankChanges() {
        ProposalPageController controller = new ProposalPageController();
        controller.requestedChanges = '';
        
        Test.startTest();
        controller.saveRequestChanges();
        Test.stopTest();
        
        System.assert(controller.quoteMessage.contains('No requested changes provided'), 'Should show error message');
        System.assertEquals(null, controller.strBody, 'Body should be null');
    }
    
    @isTest
    static void testSaveRequestChanges_Exception() {
        ProposalPageController controller = new ProposalPageController();
        controller.proposalRecipientId = 'invalidId';
        controller.requestedChanges = 'Test changes';
        
        Test.startTest();
        controller.saveRequestChanges();
        Test.stopTest();
        
        System.assert(controller.quoteMessage.contains('Error saving change request'), 'Should show error message');
        System.assertEquals(null, controller.strBody, 'Body should be null');
    }
    
    @isTest
    static void testUploadSignature_Success() {
        wfrecon__Proposal_Recipient__c proRec = [SELECT Id FROM wfrecon__Proposal_Recipient__c LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id, Name FROM wfrecon__Proposal__c LIMIT 1];
        
        ProposalPageController controller = new ProposalPageController();
        controller.proposalRecipientId = proRec.Id;
        controller.proRecRecord = new wfrecon__Proposal_Recipient__c();
        controller.proRecRecord.wfrecon__Proposal__r = proposal;
        controller.signatureData = EncodingUtil.base64Encode(Blob.valueOf('Test Signature Data'));
        
        Test.startTest();
        PageReference result = controller.uploadSignature();
        Test.stopTest();
        
        System.assertEquals(null, result, 'Should return null');
        System.assertEquals('Accepted', controller.proposalStatus, 'Status should be Accepted');
        System.assertEquals('Accepted', controller.result, 'Result should be Accepted');
        System.assertEquals(true, controller.customSignature, 'Custom signature should be true');
        System.assertNotEquals(null, controller.cdId, 'Content distribution ID should be set');
        System.assertNotEquals(null, controller.customerAcceptedDate, 'Customer accepted date should be set');
        
        // Verify proposal recipient was updated
        wfrecon__Proposal_Recipient__c updatedRec = [
            SELECT Id, wfrecon__Status__c, wfrecon__Accepted_Rejected_Changed_Date__c
            FROM wfrecon__Proposal_Recipient__c
            WHERE Id = :proRec.Id
        ];
        System.assertEquals('Accepted', updatedRec.wfrecon__Status__c, 'Status should be Accepted');
        System.assertNotEquals(null, updatedRec.wfrecon__Accepted_Rejected_Changed_Date__c, 'Date should be set');
        
        // Verify content version was created
        List<ContentVersion> contentVersions = [
            SELECT Id, Title
            FROM ContentVersion
            WHERE Title LIKE 'Signature%'
        ];
        System.assert(contentVersions.size() > 0, 'Content version should be created');
        
        // Verify content document link was created
        List<ContentDocumentLink> docLinks = [
            SELECT Id
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :proRec.Id
        ];
        System.assert(docLinks.size() > 0, 'Content document link should be created');
    }
    
    @isTest
    static void testUploadSignature_BlankSignature() {
        ProposalPageController controller = new ProposalPageController();
        controller.signatureData = '';
        
        Test.startTest();
        PageReference result = controller.uploadSignature();
        Test.stopTest();
        
        System.assertEquals(null, result, 'Should return null');
        System.assert(controller.quoteMessage.contains('No signature provided'), 'Should show error message');
        System.assertEquals(null, controller.strBody, 'Body should be null');
    }
    
    @isTest
    static void testUploadSignature_Exception() {
        ProposalPageController controller = new ProposalPageController();
        controller.proposalRecipientId = 'invalidId';
        controller.signatureData = EncodingUtil.base64Encode(Blob.valueOf('Test'));
        
        Test.startTest();
        PageReference result = controller.uploadSignature();
        Test.stopTest();
        
        System.assertEquals(null, result, 'Should return null');
        System.assert(controller.quoteMessage.contains('Error saving signature'), 'Should show error message');
        System.assertEquals(null, controller.strBody, 'Body should be null');
    }
    
    @isTest
    static void testInsertAttachment_Success() {
        wfrecon__Proposal_Recipient__c proRec = [SELECT Id FROM wfrecon__Proposal_Recipient__c LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id, Name FROM wfrecon__Proposal__c LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        // Create content distribution first
        ContentVersion conVer = new ContentVersion();
        conVer.ContentLocation = 'S';
        conVer.PathOnClient = 'Signature.png';
        conVer.Title = 'Signature';
        conVer.VersionData = Blob.valueOf('Test');
        insert conVer;
        
        Id conDoc = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :conVer.Id].ContentDocumentId;
        
        ContentDistribution cd = new ContentDistribution();
        cd.Name = 'Test Distribution';
        cd.ContentVersionId = conVer.Id;
        cd.PreferencesAllowOriginalDownload = true;
        cd.PreferencesAllowPDFDownload = true;
        cd.PreferencesAllowViewInBrowser = true;
        insert cd;
        
        ProposalPageController controller = new ProposalPageController();
        controller.proposalRecipientId = proRec.Id;
        controller.recordID = proposal.Id;
        controller.templateId = template.Id;
        controller.contactId = con.Id;
        controller.cdId = cd.Id;
        controller.customerAcceptedDate = '01-01-2026 12:00:00';
        controller.proRecRecord = new wfrecon__Proposal_Recipient__c();
        controller.proRecRecord.wfrecon__Proposal__r = proposal;
        
        Test.startTest();
        PageReference result = controller.insertAttachment();
        Test.stopTest();
        
        System.assertEquals(null, result, 'Should return null');
        System.assertEquals('Accepted', controller.proposalStatus, 'Status should be Accepted');
        System.assertEquals(true, controller.customSignature, 'Custom signature should be true');
        
        // Verify PDF content version was created
        List<ContentVersion> pdfVersions = [
            SELECT Id, Title
            FROM ContentVersion
            WHERE Title LIKE 'Proposal%'
        ];
        System.assert(pdfVersions.size() > 0, 'PDF content version should be created');
    }
    
    @isTest
    static void testInsertAttachment_BlankCdId() {
        ProposalPageController controller = new ProposalPageController();
        controller.cdId = '';
        
        Test.startTest();
        PageReference result = controller.insertAttachment();
        Test.stopTest();
        
        System.assertEquals(null, result, 'Should return null');
        System.assert(controller.quoteMessage.contains('No signature distribution found'), 'Should show error message');
        System.assertEquals(null, controller.strBody, 'Body should be null');
    }
    
    @isTest
    static void testInsertAttachment_Exception() {
        ProposalPageController controller = new ProposalPageController();
        controller.cdId = 'invalidId';
        
        Test.startTest();
        PageReference result = controller.insertAttachment();
        Test.stopTest();
        
        System.assertEquals(null, result, 'Should return null');
        System.assert(controller.quoteMessage.contains('Error generating PDF'), 'Should show error message');
        System.assertEquals(null, controller.strBody, 'Body should be null');
    }
}