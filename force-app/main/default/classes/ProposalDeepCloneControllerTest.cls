/**
* Test Class Name: ProposalDeepCloneControllerTest
* @description: Test class for ProposalDeepCloneController
**/
@isTest
private class ProposalDeepCloneControllerTest {
    
    @testSetup
    static void setupTestData() {
        // Create Proposal
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        proposal.wfrecon__OH__c = 10.0;
        proposal.wfrecon__Warranty__c = 5.0;
        proposal.wfrecon__Profit__c = 15.0;
        insert proposal;
        
        // Create Proposal Lines
        List<wfrecon__Proposal_Line__c> proposalLines = new List<wfrecon__Proposal_Line__c>();
        
        wfrecon__Proposal_Line__c line1 = new wfrecon__Proposal_Line__c();
        line1.wfrecon__Proposal__c = proposal.Id;
        line1.Name = 'Proposal Line 1';
        line1.wfrecon__Quantity__c = 2;
        line1.wfrecon__OH_Per__c = 10.0;
        line1.wfrecon__Warranty_Per__c = 5.0;
        line1.wfrecon__Profit_Per__c = 15.0;
        line1.wfrecon__Type__c = 'Base Contract';
        line1.wfrecon__Sequence__c = 1;
        proposalLines.add(line1);
        
        wfrecon__Proposal_Line__c line2 = new wfrecon__Proposal_Line__c();
        line2.wfrecon__Proposal__c = proposal.Id;
        line2.Name = 'Proposal Line 2';
        line2.wfrecon__Quantity__c = 3;
        line2.wfrecon__OH_Per__c = 12.0;
        line2.wfrecon__Warranty_Per__c = 6.0;
        line2.wfrecon__Profit_Per__c = 18.0;
        line2.wfrecon__Type__c = 'Alternate';
        line2.wfrecon__Sequence__c = 0;
        proposalLines.add(line2);
        
        insert proposalLines;
        
        // Create Budgets
        List<wfrecon__Budget__c> budgets = new List<wfrecon__Budget__c>();
        
        wfrecon__Budget__c budget1 = new wfrecon__Budget__c();
        budget1.wfrecon__Proposal_Line__c = proposalLines[0].Id;
        budgets.add(budget1);
        
        wfrecon__Budget__c budget2 = new wfrecon__Budget__c();
        budget2.wfrecon__Proposal_Line__c = proposalLines[1].Id;
        budgets.add(budget2);
        
        insert budgets;
        
        // Create Budget Lines
        List<wfrecon__Budget_Line__c> budgetLines = new List<wfrecon__Budget_Line__c>();
        
        wfrecon__Budget_Line__c budgetLine1 = new wfrecon__Budget_Line__c();
        budgetLine1.wfrecon__Budget__c = budgets[0].Id;
        budgetLine1.wfrecon__Cost_Type__c = 'Labor';
        budgetLine1.wfrecon__No_Of_Crew_Members__c = 2;
        budgetLine1.wfrecon__Hrs_day__c = 8;
        budgetLine1.wfrecon__Burden_Rate_Hour__c = 50.0;
        budgetLine1.wfrecon__of_Days__c = 5;
        budgetLine1.wfrecon__Note__c = 'Test Note 1';
        budgetLines.add(budgetLine1);
        
        wfrecon__Budget_Line__c budgetLine2 = new wfrecon__Budget_Line__c();
        budgetLine2.wfrecon__Budget__c = budgets[0].Id;
        budgetLine2.wfrecon__Cost_Type__c = 'Materials';
        budgetLine2.wfrecon__Material__c = 'Test Material';
        budgetLine2.wfrecon__QTY__c = 10;
        budgetLine2.wfrecon__Cost_Each__c = 25.0;
        budgetLines.add(budgetLine2);
        
        wfrecon__Budget_Line__c budgetLine3 = new wfrecon__Budget_Line__c();
        budgetLine3.wfrecon__Budget__c = budgets[1].Id;
        budgetLine3.wfrecon__Cost_Type__c = 'Hotel';
        budgetLine3.wfrecon__Of_Nights__c = 3;
        budgetLine3.wfrecon__Number_Of_Rooms__c = 2;
        budgetLine3.wfrecon__Costs_Per_Night__c = 100.0;
        budgetLines.add(budgetLine3);
        
        insert budgetLines;
    }
    
    @isTest
    static void testCloneProposal_Success() {
        wfrecon__Proposal__c originalProposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        Test.startTest();
        String clonedProposalId = ProposalDeepCloneController.cloneProposal(originalProposal.Id);
        Test.stopTest();
        
        // Verify cloned proposal was created
        System.assertNotEquals(null, clonedProposalId, 'Cloned proposal ID should not be null');
        System.assertNotEquals(originalProposal.Id, clonedProposalId, 'Cloned proposal should have different ID');
        
        // Verify proposal was cloned
        List<wfrecon__Proposal__c> clonedProposals = [
            SELECT Id, Name, wfrecon__OH__c, wfrecon__Warranty__c, wfrecon__Profit__c
            FROM wfrecon__Proposal__c
            WHERE Id = :clonedProposalId
        ];
        System.assertEquals(1, clonedProposals.size(), 'Cloned proposal should exist');
        
        wfrecon__Proposal__c original = [SELECT Name, wfrecon__OH__c, wfrecon__Warranty__c, wfrecon__Profit__c 
                                         FROM wfrecon__Proposal__c 
                                         WHERE Id = :originalProposal.Id];
        wfrecon__Proposal__c cloned = clonedProposals[0];
        
        System.assertEquals(original.wfrecon__OH__c, cloned.wfrecon__OH__c, 'OH should be cloned');
        System.assertEquals(original.wfrecon__Warranty__c, cloned.wfrecon__Warranty__c, 'Warranty should be cloned');
        System.assertEquals(original.wfrecon__Profit__c, cloned.wfrecon__Profit__c, 'Profit should be cloned');
        
        // Verify proposal lines were cloned
        List<wfrecon__Proposal_Line__c> clonedLines = [
            SELECT Id, Name, wfrecon__Quantity__c, wfrecon__Type__c, wfrecon__Sequence__c
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :clonedProposalId
            ORDER BY wfrecon__Sequence__c ASC NULLS LAST
        ];
        System.assertEquals(2, clonedLines.size(), 'Should clone 2 proposal lines');
        
        // Verify budgets were cloned
        List<wfrecon__Budget__c> clonedBudgets = [
            SELECT Id, wfrecon__Proposal_Line__c
            FROM wfrecon__Budget__c
            WHERE wfrecon__Proposal_Line__c IN :clonedLines
        ];
        System.assertEquals(2, clonedBudgets.size(), 'Should clone 2 budgets');
        
        // Verify budget lines were cloned
        List<wfrecon__Budget_Line__c> clonedBudgetLines = [
            SELECT Id, wfrecon__Budget__c, wfrecon__Cost_Type__c, wfrecon__Note__c
            FROM wfrecon__Budget_Line__c
            WHERE wfrecon__Budget__c IN :clonedBudgets
        ];
        System.assertEquals(3, clonedBudgetLines.size(), 'Should clone 3 budget lines');
        
        // Verify relationships are correct
        for (wfrecon__Budget__c budget : clonedBudgets) {
            Boolean found = false;
            for (wfrecon__Proposal_Line__c line : clonedLines) {
                if (budget.wfrecon__Proposal_Line__c == line.Id) {
                    found = true;
                    break;
                }
            }
            System.assert(found, 'Budget should be linked to cloned proposal line');
        }
        
        for (wfrecon__Budget_Line__c budgetLine : clonedBudgetLines) {
            Boolean found = false;
            for (wfrecon__Budget__c budget : clonedBudgets) {
                if (budgetLine.wfrecon__Budget__c == budget.Id) {
                    found = true;
                    break;
                }
            }
            System.assert(found, 'Budget line should be linked to cloned budget');
        }
    }
    
    @isTest
    static void testCloneProposal_NoProposalLines() {
        // Create proposal without lines
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        proposal.wfrecon__OH__c = 10.0;
        insert proposal;
        
        Test.startTest();
        String clonedProposalId = ProposalDeepCloneController.cloneProposal(proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, clonedProposalId, 'Cloned proposal ID should not be null');
        
        // Verify proposal was cloned
        List<wfrecon__Proposal__c> clonedProposals = [
            SELECT Id
            FROM wfrecon__Proposal__c
            WHERE Id = :clonedProposalId
        ];
        System.assertEquals(1, clonedProposals.size(), 'Cloned proposal should exist');
        
        // Verify no proposal lines were cloned
        List<wfrecon__Proposal_Line__c> clonedLines = [
            SELECT Id
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :clonedProposalId
        ];
        System.assertEquals(0, clonedLines.size(), 'Should not clone any proposal lines');
    }
    
    @isTest
    static void testCloneProposal_NoBudgets() {
        // Create proposal with lines but no budgets
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;
        
        wfrecon__Proposal_Line__c line = new wfrecon__Proposal_Line__c();
        line.wfrecon__Proposal__c = proposal.Id;
        line.Name = 'Line Without Budget';
        line.wfrecon__Quantity__c = 1;
        insert line;
        
        Test.startTest();
        String clonedProposalId = ProposalDeepCloneController.cloneProposal(proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, clonedProposalId, 'Cloned proposal ID should not be null');
        
        // Verify proposal line was cloned
        List<wfrecon__Proposal_Line__c> clonedLines = [
            SELECT Id
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :clonedProposalId
        ];
        System.assertEquals(1, clonedLines.size(), 'Should clone proposal line');
        
        // Verify no budgets were cloned
        List<wfrecon__Budget__c> clonedBudgets = [
            SELECT Id
            FROM wfrecon__Budget__c
            WHERE wfrecon__Proposal_Line__c IN :clonedLines
        ];
        System.assertEquals(0, clonedBudgets.size(), 'Should not clone any budgets');
    }
    
    @isTest
    static void testCloneProposal_NoBudgetLines() {
        // Create proposal with lines and budgets but no budget lines
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;
        
        wfrecon__Proposal_Line__c line = new wfrecon__Proposal_Line__c();
        line.wfrecon__Proposal__c = proposal.Id;
        line.Name = 'Line With Budget';
        line.wfrecon__Quantity__c = 1;
        insert line;
        
        wfrecon__Budget__c budget = new wfrecon__Budget__c();
        budget.wfrecon__Proposal_Line__c = line.Id;
        insert budget;
        
        Test.startTest();
        String clonedProposalId = ProposalDeepCloneController.cloneProposal(proposal.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, clonedProposalId, 'Cloned proposal ID should not be null');
        
        // Verify budget was cloned
        List<wfrecon__Proposal_Line__c> clonedLines = [
            SELECT Id
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :clonedProposalId
        ];
        
        List<wfrecon__Budget__c> clonedBudgets = [
            SELECT Id
            FROM wfrecon__Budget__c
            WHERE wfrecon__Proposal_Line__c IN :clonedLines
        ];
        System.assertEquals(1, clonedBudgets.size(), 'Should clone budget');
        
        // Verify no budget lines were cloned
        List<wfrecon__Budget_Line__c> clonedBudgetLines = [
            SELECT Id
            FROM wfrecon__Budget_Line__c
            WHERE wfrecon__Budget__c IN :clonedBudgets
        ];
        System.assertEquals(0, clonedBudgetLines.size(), 'Should not clone any budget lines');
    }
    
    @isTest
    static void testCloneProposal_InvalidProposalId() {
        
        
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
        insert proposal;
        
        wfrecon__Proposal_Line__c line = new wfrecon__Proposal_Line__c();
        line.wfrecon__Proposal__c = proposal.Id;
        line.Name = 'Line With Budget';
        line.wfrecon__Quantity__c = 1;
        insert line;
        
        Test.startTest();
        String clonedProposalId = ProposalDeepCloneController.cloneProposal(line.Id);
        Test.stopTest();
        
        System.assertEquals(null, clonedProposalId, 'Should return null for invalid proposal ID');
    }
    
    @isTest
    static void testCloneProposal_NullProposalId() {
        Test.startTest();
        String clonedProposalId = ProposalDeepCloneController.cloneProposal(null);
        Test.stopTest();
        
        System.assertEquals(null, clonedProposalId, 'Should return null for null proposal ID');
    }
    
    @isTest
    static void testCloneProposal_VerifyDataIntegrity() {
        wfrecon__Proposal__c originalProposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        // Get original data
        List<wfrecon__Proposal_Line__c> originalLines = [
            SELECT Id, Name, wfrecon__Quantity__c, wfrecon__OH_Per__c, 
                   wfrecon__Warranty_Per__c, wfrecon__Profit_Per__c, 
                   wfrecon__Type__c, wfrecon__Sequence__c
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :originalProposal.Id
            ORDER BY wfrecon__Sequence__c ASC NULLS LAST
        ];
        
        List<wfrecon__Budget__c> originalBudgets = [
            SELECT Id, wfrecon__Proposal_Line__c
            FROM wfrecon__Budget__c
            WHERE wfrecon__Proposal_Line__c IN :originalLines
        ];
        
        List<wfrecon__Budget_Line__c> originalBudgetLines = [
            SELECT Id, wfrecon__Budget__c, wfrecon__Cost_Type__c, 
                   wfrecon__No_Of_Crew_Members__c, wfrecon__Note__c,
                   wfrecon__Material__c, wfrecon__QTY__c
            FROM wfrecon__Budget_Line__c
            WHERE wfrecon__Budget__c IN :originalBudgets
        ];
        
        Test.startTest();
        String clonedProposalId = ProposalDeepCloneController.cloneProposal(originalProposal.Id);
        Test.stopTest();
        
        // Get cloned data
        List<wfrecon__Proposal_Line__c> clonedLines = [
            SELECT Id, Name, wfrecon__Quantity__c, wfrecon__OH_Per__c, 
                   wfrecon__Warranty_Per__c, wfrecon__Profit_Per__c, 
                   wfrecon__Type__c, wfrecon__Sequence__c
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :clonedProposalId
            ORDER BY wfrecon__Sequence__c ASC NULLS LAST
        ];
        
        // Verify proposal lines data integrity
        System.assertEquals(originalLines.size(), clonedLines.size(), 'Should clone all proposal lines');
        
        for (Integer i = 0; i < originalLines.size(); i++) {
            System.assertEquals(originalLines[i].Name, clonedLines[i].Name, 'Line name should match');
            System.assertEquals(originalLines[i].wfrecon__Quantity__c, clonedLines[i].wfrecon__Quantity__c, 'Quantity should match');
            System.assertEquals(originalLines[i].wfrecon__OH_Per__c, clonedLines[i].wfrecon__OH_Per__c, 'OH% should match');
            System.assertEquals(originalLines[i].wfrecon__Warranty_Per__c, clonedLines[i].wfrecon__Warranty_Per__c, 'Warranty% should match');
            System.assertEquals(originalLines[i].wfrecon__Profit_Per__c, clonedLines[i].wfrecon__Profit_Per__c, 'Profit% should match');
            System.assertEquals(originalLines[i].wfrecon__Type__c, clonedLines[i].wfrecon__Type__c, 'Type should match');
            System.assertEquals(originalLines[i].wfrecon__Sequence__c, clonedLines[i].wfrecon__Sequence__c, 'Sequence should match');
        }
        
        // Verify budgets and budget lines data integrity
        List<wfrecon__Budget__c> clonedBudgets = [
            SELECT Id, wfrecon__Proposal_Line__c
            FROM wfrecon__Budget__c
            WHERE wfrecon__Proposal_Line__c IN :clonedLines
        ];
        
        System.assertEquals(originalBudgets.size(), clonedBudgets.size(), 'Should clone all budgets');
        
        List<wfrecon__Budget_Line__c> clonedBudgetLines = [
            SELECT Id, wfrecon__Budget__c, wfrecon__Cost_Type__c, 
                   wfrecon__No_Of_Crew_Members__c, wfrecon__Note__c,
                   wfrecon__Material__c, wfrecon__QTY__c
            FROM wfrecon__Budget_Line__c
            WHERE wfrecon__Budget__c IN :clonedBudgets
        ];
        
        System.assertEquals(originalBudgetLines.size(), clonedBudgetLines.size(), 'Should clone all budget lines');
        
        // Verify budget line data matches
        for (wfrecon__Budget_Line__c originalLine : originalBudgetLines) {
            Boolean found = false;
            for (wfrecon__Budget_Line__c clonedLine : clonedBudgetLines) {
                if (originalLine.wfrecon__Cost_Type__c == clonedLine.wfrecon__Cost_Type__c) {
                    if (originalLine.wfrecon__Cost_Type__c == 'Labor') {
                        if (originalLine.wfrecon__No_Of_Crew_Members__c == clonedLine.wfrecon__No_Of_Crew_Members__c &&
                            originalLine.wfrecon__Note__c == clonedLine.wfrecon__Note__c) {
                            found = true;
                            break;
                        }
                    } else if (originalLine.wfrecon__Cost_Type__c == 'Materials') {
                        if (originalLine.wfrecon__Material__c == clonedLine.wfrecon__Material__c &&
                            originalLine.wfrecon__QTY__c == clonedLine.wfrecon__QTY__c) {
                            found = true;
                            break;
                        }
                    } else {
                        found = true;
                        break;
                    }
                }
            }
            System.assert(found, 'Budget line data should be cloned correctly');
        }
    }
    
    @isTest
    static void testCloneProposal_VerifyOriginalDataUnchanged() {
        wfrecon__Proposal__c originalProposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        // Get original counts
        Integer originalProposalCount = [SELECT COUNT() FROM wfrecon__Proposal__c];
        Integer originalLineCount = [SELECT COUNT() FROM wfrecon__Proposal_Line__c];
        Integer originalBudgetCount = [SELECT COUNT() FROM wfrecon__Budget__c];
        Integer originalBudgetLineCount = [SELECT COUNT() FROM wfrecon__Budget_Line__c];
        
        Test.startTest();
        String clonedProposalId = ProposalDeepCloneController.cloneProposal(originalProposal.Id);
        Test.stopTest();
        
        // Verify original proposal still exists
        List<wfrecon__Proposal__c> originalProposals = [
            SELECT Id
            FROM wfrecon__Proposal__c
            WHERE Id = :originalProposal.Id
        ];
        System.assertEquals(1, originalProposals.size(), 'Original proposal should still exist');
        
        // Verify counts increased (original + cloned)
        Integer newProposalCount = [SELECT COUNT() FROM wfrecon__Proposal__c];
        Integer newLineCount = [SELECT COUNT() FROM wfrecon__Proposal_Line__c];
        Integer newBudgetCount = [SELECT COUNT() FROM wfrecon__Budget__c];
        Integer newBudgetLineCount = [SELECT COUNT() FROM wfrecon__Budget_Line__c];
        
        System.assertEquals(originalProposalCount + 1, newProposalCount, 'Should have one more proposal');
        System.assertEquals(originalLineCount + 2, newLineCount, 'Should have 2 more proposal lines');
        System.assertEquals(originalBudgetCount + 2, newBudgetCount, 'Should have 2 more budgets');
        System.assertEquals(originalBudgetLineCount + 3, newBudgetLineCount, 'Should have 3 more budget lines');
    }
}