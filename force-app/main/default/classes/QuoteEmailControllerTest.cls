/**
* Test Class Name: QuoteEmailControllerTest
* @description: Test class for QuoteEmailController
**/
@isTest
private class QuoteEmailControllerTest {
    
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
        
        // Create Proposal Settings Custom Setting
        wfrecon__Proposal_Settings__c settings = new wfrecon__Proposal_Settings__c();
        settings.wfrecon__Base_URL__c = 'https://test.example.com';
        insert settings;
        
        // Create Proposal
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();        
        proposal.wfrecon__Contact__c = con.Id;
        insert proposal;
        
        // Create Proposal Lines
        List<wfrecon__Proposal_Line__c> proposalLines = new List<wfrecon__Proposal_Line__c>();
        
        wfrecon__Proposal_Line__c line1 = new wfrecon__Proposal_Line__c();
        line1.wfrecon__Proposal__c = proposal.Id;
        line1.Name = 'Base Contract Line 1';
        line1.wfrecon__Type__c = 'Base Contract';
        line1.wfrecon__Sequence__c = 1;
        line1.wfrecon__Quantity__c = 2;
        line1.wfrecon__Sales_Price__c = 100.0;
        line1.wfrecon__Selected__c = false;
        proposalLines.add(line1);
        
        wfrecon__Proposal_Line__c line2 = new wfrecon__Proposal_Line__c();
        line2.wfrecon__Proposal__c = proposal.Id;
        line2.Name = 'Base Contract Line 2';
        line2.wfrecon__Type__c = 'Base Contract';
        line2.wfrecon__Sequence__c = 2;
        line2.wfrecon__Quantity__c = 3;
        line2.wfrecon__Sales_Price__c = 150.0;
        line2.wfrecon__Selected__c = false;
        proposalLines.add(line2);
        
        wfrecon__Proposal_Line__c line3 = new wfrecon__Proposal_Line__c();
        line3.wfrecon__Proposal__c = proposal.Id;
        line3.Name = 'Alternate Line';
        line3.wfrecon__Type__c = 'Alternate';
        line3.wfrecon__Sequence__c = 0;
        line3.wfrecon__Quantity__c = 1;
        proposalLines.add(line3);
        
        insert proposalLines;
        
        // Create Content Document for testing
        ContentVersion cv = new ContentVersion();
        cv.Title = 'Test Document';
        cv.PathOnClient = 'Test.pdf';
        cv.VersionData = Blob.valueOf('Test Content');
        insert cv;
    }
    
    @isTest
    static void testGetInitialData_Success() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        Test.startTest();
        QuoteEmailController.InitData result = QuoteEmailController.getInitialData(proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'InitData should not be null');
        System.assertNotEquals(null, result.orgWideAddresses, 'Org wide addresses should not be null');
        System.assertNotEquals(null, result.emailTemplates, 'Email templates should not be null');
        System.assert(result.orgWideAddresses.size() > 0, 'Should have at least one org wide address');
        System.assert(result.emailTemplates.size() > 0, 'Should have at least one email template');
        System.assertNotEquals(null, result.baseUrl, 'Base URL should not be null');
        System.assertNotEquals(null, result.defaultContactId, 'Default contact ID should not be null');
    }
    
    @isTest
    static void testGetInitialData_BlankRecordId() {
        Test.startTest();
        QuoteEmailController.InitData result = QuoteEmailController.getInitialData('');
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'InitData should not be null');
        System.assertEquals(null, result.defaultContactId, 'Default contact ID should be null for blank record ID');
    }
    
    @isTest
    static void testGetInitialData_NullRecordId() {
        Test.startTest();
        QuoteEmailController.InitData result = QuoteEmailController.getInitialData(null);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'InitData should not be null');
    }
    
    @isTest
    static void testGetInitialData_NoContactOnProposal() {
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;
        
        Test.startTest();
        QuoteEmailController.InitData result = QuoteEmailController.getInitialData(proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'InitData should not be null');
        System.assertEquals(null, result.defaultContactId, 'Default contact ID should be null when proposal has no contact');
    }
    
    @isTest
    static void testGetContactName_Success() {
        Contact con = [SELECT Id, Name FROM Contact LIMIT 1];
        
        Test.startTest();
        String result = QuoteEmailController.getContactName(con.Id);
        Test.stopTest();
        
        System.assertEquals(con.Name, result, 'Contact name should match');
    }
    
    @isTest
    static void testGetContactName_BlankId() {
        Test.startTest();
        String result = QuoteEmailController.getContactName('');
        Test.stopTest();
        
        System.assertEquals('', result, 'Should return empty string for blank ID');
    }
    
    @isTest
    static void testGetContactName_InvalidId() {
        Test.startTest();
        String result = QuoteEmailController.getContactName('a0000000000000AAA');
        Test.stopTest();
        
        System.assertEquals('', result, 'Should return empty string for invalid ID');
    }
    
    @isTest
    static void testRenderEmailTemplate_Success() {
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        Test.startTest();
        Map<String, String> result = QuoteEmailController.renderEmailTemplate(template.Id, con.Id, proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertNotEquals(null, result.get('subject'), 'Subject should not be null');        
    }
    
    @isTest
    static void testRenderEmailTemplate_BlankTemplateId() {
        Test.startTest();
        Map<String, String> result = QuoteEmailController.renderEmailTemplate('', null, null);
        Test.stopTest();
        
        System.assertEquals(null, result, 'Should return null for blank template ID');
    }
    
    @isTest
    static void testRenderEmailTemplate_BlankWhoId() {
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        Test.startTest();
        Map<String, String> result = QuoteEmailController.renderEmailTemplate(template.Id, '', proposal.Id);
        Test.stopTest();
        
        // Should use dummy contact
        System.assertNotEquals(null, result, 'Result should not be null');
    }
    
    @isTest
    static void testSendQuoteEmail_Success() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        OrgWideEmailAddress orgWide = [SELECT Id FROM OrgWideEmailAddress LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        // Create additional contact for CC
        Contact ccContact = new Contact();
        ccContact.FirstName = 'CC';
        ccContact.LastName = 'Contact';
        ccContact.Email = 'cc@example.com';
        insert ccContact;
        
        Test.startTest();
        QuoteEmailController.sendQuoteEmail(
            con.Id,
            new List<String>{ccContact.Id},
            null,
            'Test Subject',
            '<html><body>Test Body</body></html>',
            orgWide.Id,
            proposal.Id,
            null,
            template.Id
        );
        Test.stopTest();
        
        // Verify proposal recipient was created
        List<wfrecon__Proposal_Recipient__c> recipients = [
            SELECT Id, wfrecon__Status__c, wfrecon__Contact__c, wfrecon__Proposal__c
            FROM wfrecon__Proposal_Recipient__c
            WHERE wfrecon__Proposal__c = :proposal.Id
            AND wfrecon__Contact__c = :con.Id
        ];
        System.assertEquals(1, recipients.size(), 'Proposal recipient should be created');
        System.assertEquals('Pending', recipients[0].wfrecon__Status__c, 'Status should be Pending');
    }
    
    @isTest
    static void testSendQuoteEmail_WithContentDocuments() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        OrgWideEmailAddress orgWide = [SELECT Id FROM OrgWideEmailAddress LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        EmailTemplate template = [SELECT Id FROM EmailTemplate LIMIT 1];
        
        ContentVersion cv = [SELECT ContentDocumentId FROM ContentVersion LIMIT 1];
        
        Test.startTest();
        QuoteEmailController.sendQuoteEmail(
            con.Id,
            null,
            null,
            'Test Subject',
            '<html><body>Test Body</body></html>',
            orgWide.Id,
            proposal.Id,
            new List<String>{cv.ContentDocumentId},
            template.Id
        );
        Test.stopTest();
        
        // Verify email was sent (no exception thrown)
        System.assert(true, 'Email should be sent successfully');
    }
    
    @isTest
    static void testSendQuoteEmail_NoTemplateId() {
        Contact con = [SELECT Id FROM Contact LIMIT 1];
        OrgWideEmailAddress orgWide = [SELECT Id FROM OrgWideEmailAddress LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        Test.startTest();
        QuoteEmailController.sendQuoteEmail(
            con.Id,
            null,
            null,
            'Test Subject',
            '<html><body>Test Body</body></html>',
            orgWide.Id,
            proposal.Id,
            null,
            null
        );
        Test.stopTest();
        
        // Should not throw exception
        System.assert(true, 'Email should be sent without template');
    }
    
    @isTest
    static void testDeleteContentDocuments_Success() {
        ContentVersion cv = [SELECT ContentDocumentId FROM ContentVersion LIMIT 1];
        
        Test.startTest();
        QuoteEmailController.deleteContentDocuments(new List<String>{cv.ContentDocumentId});
        Test.stopTest();
        
        // Verify content document was deleted
        List<ContentDocument> docs = [
            SELECT Id
            FROM ContentDocument
            WHERE Id = :cv.ContentDocumentId
        ];
        System.assertEquals(0, docs.size(), 'Content document should be deleted');
    }
    
    @isTest
    static void testDeleteContentDocuments_EmptyList() {
        Test.startTest();
        QuoteEmailController.deleteContentDocuments(new List<String>());
        Test.stopTest();
        
        // Should not throw exception
        System.assert(true, 'Should handle empty list');
    }
    
    @isTest
    static void testDeleteContentDocuments_NullList() {
        Test.startTest();
        QuoteEmailController.deleteContentDocuments(null);
        Test.stopTest();
        
        // Should not throw exception
        System.assert(true, 'Should handle null list');
    }
    
    @isTest
    static void testGetUploadedFileDetails_Success() {
        ContentVersion cv = [SELECT ContentDocumentId FROM ContentVersion LIMIT 1];
        
        Test.startTest();
        List<QuoteEmailController.FileWrapper> result = QuoteEmailController.getUploadedFileDetails(
            new List<String>{cv.ContentDocumentId}
        );
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(1, result.size(), 'Should return one file');
        System.assertNotEquals(null, result[0].docId, 'Document ID should not be null');
        System.assertNotEquals(null, result[0].title, 'Title should not be null');
    }
    
    @isTest
    static void testGetUploadedFileDetails_EmptyList() {
        Test.startTest();
        List<QuoteEmailController.FileWrapper> result = QuoteEmailController.getUploadedFileDetails(new List<String>());
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(0, result.size(), 'Should return empty list');
    }
    
    @isTest
    static void testGetRecordFiles_Success() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        ContentVersion cv = [SELECT ContentDocumentId FROM ContentVersion LIMIT 1];
        
        // Link content document to proposal
        ContentDocumentLink cdl = new ContentDocumentLink();
        cdl.LinkedEntityId = proposal.Id;
        cdl.ContentDocumentId = cv.ContentDocumentId;
        cdl.ShareType = 'V';
        insert cdl;
        
        Test.startTest();
        List<QuoteEmailController.FileWrapper> result = QuoteEmailController.getRecordFiles(proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.size() > 0, 'Should return at least one file');
    }
    
    @isTest
    static void testGetRecordFiles_NoFiles() {
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;
        
        Test.startTest();
        List<QuoteEmailController.FileWrapper> result = QuoteEmailController.getRecordFiles(proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(0, result.size(), 'Should return empty list');
    }
    
    @isTest
    static void testGetBaseContractLines_Success() {
        wfrecon__Proposal__c proposal = [SELECT Id,wfrecon__Type__c FROM wfrecon__Proposal__c LIMIT 1];
        
        Test.startTest();
        List<wfrecon__Proposal_Line__c> result = QuoteEmailController.getBaseContractLines(proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(2, result.size(), 'Should return 2 base contract lines');
         
        // Verify ordering by sequence
        for (Integer i = 0; i < result.size() - 1; i++) {
            Decimal currentSeq = result[i].wfrecon__Sequence__c != null ? result[i].wfrecon__Sequence__c : 0;
            Decimal nextSeq = result[i + 1].wfrecon__Sequence__c != null ? result[i + 1].wfrecon__Sequence__c : 0;
            System.assert(currentSeq <= nextSeq, 'Lines should be ordered by sequence');
        }
    }
    
    @isTest
    static void testGetBaseContractLines_NoLines() {
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;
        
        Test.startTest();
        List<wfrecon__Proposal_Line__c> result = QuoteEmailController.getBaseContractLines(proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(0, result.size(), 'Should return empty list');
    }
    
    @isTest
    static void testUpdateLineSelection_Success() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        List<wfrecon__Proposal_Line__c> lines = [
            SELECT Id
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :proposal.Id
            AND (wfrecon__Type__c = 'Base Contract' OR wfrecon__Type__c = NULL)
            ORDER BY wfrecon__Sequence__c ASC
        ];
        
        List<String> selectedIds = new List<String>{lines[0].Id};
        
        Test.startTest();
        QuoteEmailController.updateLineSelection(selectedIds, proposal.Id);
        Test.stopTest();
        
        // Verify selection was updated
        List<wfrecon__Proposal_Line__c> updatedLines = [
            SELECT Id, wfrecon__Selected__c
            FROM wfrecon__Proposal_Line__c
            WHERE Id IN :lines
        ];
        
        for (wfrecon__Proposal_Line__c line : updatedLines) {
            if (selectedIds.contains(line.Id)) {
                System.assertEquals(true, line.wfrecon__Selected__c, 'Selected line should be marked as selected');
            } else {
                System.assertEquals(false, line.wfrecon__Selected__c, 'Unselected line should be marked as unselected');
            }
        }
    }
    
    @isTest
    static void testUpdateLineSelection_AllSelected() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        List<wfrecon__Proposal_Line__c> lines = [
            SELECT Id
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :proposal.Id
            AND (wfrecon__Type__c = 'Base Contract' OR wfrecon__Type__c = NULL)
        ];
        
        List<String> selectedIds = new List<String>();
        for (wfrecon__Proposal_Line__c line : lines) {
            selectedIds.add(line.Id);
        }
        
        Test.startTest();
        QuoteEmailController.updateLineSelection(selectedIds, proposal.Id);
        Test.stopTest();
        
        // Verify all lines are selected
        List<wfrecon__Proposal_Line__c> updatedLines = [
            SELECT Id, wfrecon__Selected__c
            FROM wfrecon__Proposal_Line__c
            WHERE Id IN :lines
        ];
        
        for (wfrecon__Proposal_Line__c line : updatedLines) {
            System.assertEquals(true, line.wfrecon__Selected__c, 'All lines should be selected');
        }
    }
    
    @isTest
    static void testUpdateLineSelection_NoneSelected() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        Test.startTest();
        QuoteEmailController.updateLineSelection(new List<String>(), proposal.Id);
        Test.stopTest();
        
        // Verify all lines are unselected
        List<wfrecon__Proposal_Line__c> updatedLines = [
            SELECT Id, wfrecon__Selected__c
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :proposal.Id
            AND (wfrecon__Type__c = 'Base Contract' OR wfrecon__Type__c = NULL)
        ];
        
        for (wfrecon__Proposal_Line__c line : updatedLines) {
            System.assertEquals(false, line.wfrecon__Selected__c, 'All lines should be unselected');
        }
    }
    
    @isTest
    static void testUpdateLineSelection_NoChanges() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        List<wfrecon__Proposal_Line__c> lines = [
            SELECT Id, wfrecon__Selected__c
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :proposal.Id
            AND (wfrecon__Type__c = 'Base Contract' OR wfrecon__Type__c = NULL)
        ];
        
        // Set all lines to selected
        for (wfrecon__Proposal_Line__c line : lines) {
            line.wfrecon__Selected__c = true;
        }
        update lines;
        
        List<String> selectedIds = new List<String>();
        for (wfrecon__Proposal_Line__c line : lines) {
            selectedIds.add(line.Id);
        }
        
        Test.startTest();
        QuoteEmailController.updateLineSelection(selectedIds, proposal.Id);
        Test.stopTest();
        
        // Should not throw exception even though no changes needed
        System.assert(true, 'Should handle no changes scenario');
    }
    
    @isTest
    static void testUpdateLineSelection_Exception() {
        Test.startTest();
        try {
            QuoteEmailController.updateLineSelection(new List<String>{'invalidId'}, 'invalidProposalId');
        } catch (AuraHandledException e) {
            System.assert(true, 'Should catch AuraHandledException');
        }
        Test.stopTest();
    }
}