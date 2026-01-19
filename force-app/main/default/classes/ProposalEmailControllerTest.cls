@IsTest
public class ProposalEmailControllerTest {

    @TestSetup
    static void setupData() {

        // Create Proposal
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;

        // Selected Proposal Line (should be returned)
        wfrecon__Proposal_Line__c line1 = new wfrecon__Proposal_Line__c(
            Name = 'Line 1',
            wfrecon__Proposal__c = proposal.Id,
            wfrecon__Selected__c = true,
            wfrecon__Sequence__c = 1,
            wfrecon__Sales_Price__c = 100
        );

        // Another Selected Line
        wfrecon__Proposal_Line__c line2 = new wfrecon__Proposal_Line__c(
            Name = 'Line 2',
            wfrecon__Proposal__c = proposal.Id,
            wfrecon__Selected__c = true,
            wfrecon__Sequence__c = 2,
            wfrecon__Sales_Price__c = 200
        );

        // Not Selected Line (should NOT be returned)
        wfrecon__Proposal_Line__c line3 = new wfrecon__Proposal_Line__c(
            Name = 'Line 3',
            wfrecon__Proposal__c = proposal.Id,
            wfrecon__Selected__c = false,
            wfrecon__Sequence__c = 3,
            wfrecon__Sales_Price__c = 999
        );

        insert new List<wfrecon__Proposal_Line__c>{ line1, line2, line3 };

        // Budgets for line1
        wfrecon__Budget__c budget1 = new wfrecon__Budget__c(
            wfrecon__Proposal_Line__c = line1.Id
        );
        insert budget1;

        // Budget Lines for budget1
        wfrecon__Budget_Line__c bl1 = new wfrecon__Budget_Line__c(
            wfrecon__Budget__c = budget1.Id,
            wfrecon__Cost_Type__c = 'Materials',
            wfrecon__QTY__c = 2,
            wfrecon__Cost_Each__c = 10
        );

        wfrecon__Budget_Line__c bl2 = new wfrecon__Budget_Line__c(
            wfrecon__Budget__c = budget1.Id,
            wfrecon__Cost_Type__c = 'Labor',
            wfrecon__No_Of_Crew_Members__c = 1,
            wfrecon__Hrs_day__c = 8,
            wfrecon__Burden_Rate_Hour__c = 50
        );

        insert new List<wfrecon__Budget_Line__c>{ bl1, bl2 };
    }

    @IsTest
    static void testGetSortedLines() {

        wfrecon__Proposal__c proposal =
            [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];

        ProposalEmailController controller = new ProposalEmailController();
        controller.proposalId = proposal.Id;

        Test.startTest();
        List<wfrecon__Proposal_Line__c> lines = controller.getSortedLines();
        Test.stopTest();

        System.assertEquals(2, lines.size(), 'Only selected lines should be returned');

        // Check sorting by sequence
        System.assertEquals(1, lines[0].wfrecon__Sequence__c);
        System.assertEquals(2, lines[1].wfrecon__Sequence__c);

        // Check child relationships loaded
        System.assert(lines[0].wfrecon__Budgets__r.size() > 0, 'Budgets should be present');
        System.assert(
            lines[0].wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r.size() > 0,
            'Budget Lines should be present'
        );
    }

    @IsTest
    static void testGetTotalPrice() {

        wfrecon__Proposal__c proposal =
            [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];

        ProposalEmailController controller = new ProposalEmailController();
        controller.proposalId = proposal.Id;

        Test.startTest();
        Double total = controller.getTotalPrice();
        Test.stopTest();

        System.assertEquals(300, total, 'Total price should be sum of selected lines only');
    }

    @IsTest
    static void testWhenProposalIdIsNull() {

        ProposalEmailController controller = new ProposalEmailController();

        Test.startTest();
        List<wfrecon__Proposal_Line__c> lines = controller.getSortedLines();
        Double total = controller.getTotalPrice();
        Test.stopTest();

        System.assertEquals(0, lines.size(), 'Should return empty list when proposalId is null');
        System.assertEquals(0, total, 'Total should be zero when no lines exist');
    }
}