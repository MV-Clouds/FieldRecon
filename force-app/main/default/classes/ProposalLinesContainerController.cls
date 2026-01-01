/**
* Class Name: ProposalLinesContainerController
* Test Class: ProposalLinesContainerControllerTest
* @description: Controller for Proposal Lines Container
* Created Date: 31 Dec 2024
* Created By: Harsh Gandhi
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/
public with sharing class ProposalLinesContainerController {
    
    /*
    *********************************************************
    @description     : Fetch Proposal Lines Data
    @param           : {String} proposalId - Proposal Record Id
    @return          : List<Proposal_Line__c> - List of proposal line details
    ********************************************************
    */
    @AuraEnabled(cacheable=true)
    public static List<Proposal_Line__c> getProposalLines(String proposalId) {
        try {
            if (String.isBlank(proposalId)) {
                return new List<Proposal_Line__c>();
            }
            
            return [
                SELECT 
                    Id,
                    Name,
                    wfrecon__Product__c,
                    wfrecon__Product__r.Name,
                    wfrecon__Price_Book__c,
                    wfrecon__Price_Book__r.Name,
                    wfrecon__Quantity__c,
                    wfrecon__Unit_Cost__c,
                    wfrecon__Description__c
                FROM wfrecon__Proposal_Line__c
                WHERE wfrecon__Proposal__c = :proposalId
                ORDER BY CreatedDate ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching proposal lines: ' + e.getMessage());
        }
    }
}