public class ProposalEmailController {
    public Id proposalId { get; set; }
    
    // Calculate total price of all proposal lines
    public Double getTotalPrice() {
        Double total = 0;
        for (wfrecon__Proposal_Line__c line : getSortedLines()) {
            if (line.wfrecon__Sales_Price__c != null) {
                total += line.wfrecon__Sales_Price__c;
            }
        }
        return total;
    }
    
    // Fetch Proposal Lines sorted by Sequence, filtering only Selected ones
    public List<wfrecon__Proposal_Line__c> getSortedLines() {
        if (proposalId == null) return new List<wfrecon__Proposal_Line__c>();
        
        return [
            SELECT Id, Name, wfrecon__Description__c, wfrecon__Quantity__c, wfrecon__Sales_Price__c, 
                   wfrecon__Total_Cost__c, wfrecon__Sequence__c, wfrecon__Selected__c,
                   
                   // Level 1: Budgets (Relationship: wfrecon__Budgets__r)
                   (SELECT Id, Name,
                        // Level 2: Budget Lines (Relationship: wfrecon__Budget_Lines__r)
                        (SELECT Id, Name, wfrecon__Cost_Type__c,
                                wfrecon__Material__c, wfrecon__QTY__c, wfrecon__Cost_Each__c, wfrecon__Material_Cost__c,
                                wfrecon__No_Of_Crew_Members__c, wfrecon__Hrs_day__c, wfrecon__Burden_Rate_Hour__c, wfrecon__of_Days__c, wfrecon__Labor_Cost__c,
                                wfrecon__Of_Nights__c, wfrecon__Number_Of_Rooms__c, wfrecon__Costs_Per_Night__c, wfrecon__Total_Hotel_Cost__c,
                                wfrecon__Of_Trips__c, wfrecon__Of_Trucks__c, wfrecon__Mileage__c, wfrecon__Mileage_Rate__c, wfrecon__Total_Mileage__c,
                                wfrecon__Per_Diem_of_Days__c, wfrecon__Per_Diem_Rate__c, wfrecon__of_Men__c, wfrecon__Total_Per_Diem__c
                         FROM wfrecon__Budget_Lines__r
                         ORDER BY CreatedDate ASC)
                    FROM wfrecon__Budgets__r)
            FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :proposalId
            AND wfrecon__Selected__c = true
            ORDER BY wfrecon__Sequence__c ASC
        ];
    }
}