@IsTest
public class ProposalTemplatePDFControllerTest {

    @TestSetup
    static void setupData() {

        // Contact
        Contact con = new Contact(
            LastName = 'PDF Test Contact',
            Email = 'pdf@test.com' 
        );
        insert con;

        // Proposal (or parent record used by VF page)
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;      
    }

    // ------------------ SUCCESS PATH WITH CONTACT ------------------
    @IsTest
    static void testGeneratePDFBlob_WithContact() {

        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        EmailTemplate et = [SELECT Id FROM EmailTemplate LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];

        Test.startTest();
        Blob result = ProposalTemplatePDFController.generatePDFBlob(
            proposal.Id,
            et.Id,
            con.Id
        );
        Test.stopTest();

        System.assertNotEquals(null, result, 'PDF Blob should not be null');
        System.assert(result.size() > 0, 'PDF Blob should contain data');
    }

    // ------------------ SUCCESS PATH WITHOUT CONTACT ------------------
    @IsTest
    static void testGeneratePDFBlob_WithoutContact() {

        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        EmailTemplate et = [SELECT Id FROM EmailTemplate LIMIT 1];

        Test.startTest();
        Blob result = ProposalTemplatePDFController.generatePDFBlob(
            proposal.Id,
            et.Id,
            null
        );
        Test.stopTest();

        System.assertNotEquals(null, result, 'PDF Blob should be returned even without contactId');
        System.assert(result.size() > 0, 'PDF Blob should contain data');
    }

    // ------------------ EXCEPTION PATH ------------------
    @IsTest
    static void testGeneratePDFBlob_Exception() {

        Boolean exceptionThrown = false;

        try {
            Test.startTest();
            ProposalTemplatePDFController.generatePDFBlob(
                null,   // bad recordId
                null,   // bad templateId
                null
            );
            Test.stopTest();
        } catch (AuraHandledException ex) {
            exceptionThrown = true;
            System.assert(
                ex.getMessage().contains('Error generating PDF blob'),
                'Proper error message should be thrown'
            );
        }

        System.assertEquals(false, exceptionThrown, 'Exception should be thrown for invalid inputs');
    }
}