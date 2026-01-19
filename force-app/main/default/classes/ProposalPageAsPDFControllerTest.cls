@IsTest
public class ProposalPageAsPDFControllerTest {

    @TestSetup
    static void setupData() {

        // Contact
        Contact con = new Contact(
            LastName = 'Test Contact',
            Email = 'test@example.com'
        );
        insert con;

        // Proposal (or any object used as WhatId in template)
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;      
    }

    @IsTest
    static void testCreatePDF_Success() {

        Contact con = [SELECT Id FROM Contact LIMIT 1];
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        EmailTemplate et = [SELECT Id FROM EmailTemplate LIMIT 1];

        // Set VF Page context (required for ApexPages.currentPage)
        Test.setCurrentPage(new PageReference('/apex/DummyPage'));

        ApexPages.currentPage().getParameters().put('Id', proposal.Id);
        ApexPages.currentPage().getParameters().put('templateId', et.Id);
        ApexPages.currentPage().getParameters().put('imgURL', 'https://test.com/sign.png');
        ApexPages.currentPage().getParameters().put('contactId', con.Id);

        ProposalPageAsPDFController controller = new ProposalPageAsPDFController();

        Test.startTest();
        controller.createPDF();
        Test.stopTest();

        System.assertEquals(con.Id,controller.contactId,'Controller should set contactId from page parameters');

    }

    @IsTest
    static void testCreatePDF_MissingParams_HandledGracefully() {

        Test.setCurrentPage(new PageReference('/apex/DummyPage'));

        ProposalPageAsPDFController controller = new ProposalPageAsPDFController();

        Test.startTest();
        controller.createPDF();
        Test.stopTest();

        System.assertEquals(null, controller.contactId, 'Contactid should be null');

    }
}