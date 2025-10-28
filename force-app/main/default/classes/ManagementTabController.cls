public with sharing class ManagementTabController {

    public static final String CLASSNAME = 'ManagementTabController';

    @AuraEnabled
    public static List<Process__c> getProcessLibraries() {
        List<Process__c> processLibraries = new List<Process__c>();
        
        try {
            processLibraries = [
                SELECT Id, Name, Process_Name__c, Weight__c, Unit_of_Measure__c, Process_Type__c
                FROM Process__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getProcessLibraries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Process Libraries : ' + e.getMessage(), 'apiResponse' => null});
        }

        return processLibraries;
    }

    @AuraEnabled
    public static List<Crew__c> getCrewMembers() {
        List<Crew__c> crewMembers = new List<Crew__c>();
        
        try {
            crewMembers = [
                SELECT Id, Name, Description__c, Color_Code__c, Crew_Member_Count__c
                FROM Crew__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewMembers', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Crew Members : ' + e.getMessage(), 'apiResponse' => null});
        }

        return crewMembers;
    }

    @AuraEnabled
    public static Map<String, Object> saveCrew(Map<String, Object> crewData) {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'ERROR',
            'message' => 'Unable to save crew.'
        };

        try {
            if (crewData == null || crewData.isEmpty()) {
                response.put('message', 'Crew details are required.');
                return response;
            }

            Object idValue = crewData.get('Id');
            Id crewId;
            if (idValue != null) {
                crewId = idValue instanceof Id ? (Id)idValue : Id.valueOf(String.valueOf(idValue));
            }

            String crewName = (String)crewData.get('Name');
            if (String.isBlank(crewName)) {
                response.put('message', 'Crew name is required.');
                return response;
            }

            Crew__c crewRecord = new Crew__c();
            crewRecord.Name = crewName;
            if (crewId != null) {
                crewRecord.Id = crewId;
            }

            if (crewData.containsKey('Description__c')) {
                crewRecord.Description__c = (String)crewData.get('Description__c');
            }

            if (crewData.containsKey('Color_Code__c')) {
                String colorCode = (String)crewData.get('Color_Code__c');
                if (!String.isBlank(colorCode) && !colorCode.startsWith('#')) {
                    colorCode = '#' + colorCode;
                }
                crewRecord.Color_Code__c = colorCode;
            }

            Set<Id> desiredMemberIds = new Set<Id>();
            if (crewData.containsKey('memberIds') && crewData.get('memberIds') != null) {
                for (Object memberVal : (List<Object>)crewData.get('memberIds')) {
                    if (memberVal == null) {
                        continue;
                    }
                    Id contactId = memberVal instanceof Id ? (Id)memberVal : Id.valueOf(String.valueOf(memberVal));
                    desiredMemberIds.add(contactId);
                }
            }

            Boolean bypassConflictCheck = false;
            if (crewData.containsKey('bypassConflictCheck') && crewData.get('bypassConflictCheck') != null) {
                Object bypassVal = crewData.get('bypassConflictCheck');
                bypassConflictCheck = bypassVal instanceof Boolean ? (Boolean)bypassVal : Boolean.valueOf(String.valueOf(bypassVal));
            }

            if (!bypassConflictCheck && !desiredMemberIds.isEmpty()) {
                Map<Id, Map<String, Object>> conflictMap = new Map<Id, Map<String, Object>>();

                for (Crew_Member__c membership : [
                    SELECT Id, Contact__c, Contact__r.Name, Crew__c, Crew__r.Name
                    FROM Crew_Member__c
                    WHERE Contact__c IN :desiredMemberIds
                    WITH USER_MODE
                ]) {
                    if (crewId != null && membership.Crew__c == crewId) {
                        continue;
                    }

                    Map<String, Object> conflictInfo = conflictMap.get(membership.Contact__c);
                    if (conflictInfo == null) {
                        conflictInfo = new Map<String, Object>{
                            'contactId' => membership.Contact__c,
                            'contactName' => membership.Contact__r != null ? membership.Contact__r.Name : null,
                            'crewIds' => new List<Id>(),
                            'crewNames' => new List<String>()
                        };
                    }

                    ((List<Id>)conflictInfo.get('crewIds')).add(membership.Crew__c);
                    ((List<String>)conflictInfo.get('crewNames')).add(membership.Crew__r != null ? membership.Crew__r.Name : null);
                    conflictMap.put(membership.Contact__c, conflictInfo);
                }

                if (!conflictMap.isEmpty()) {
                    List<Map<String, Object>> conflictDetails = new List<Map<String, Object>>();
                    for (Map<String, Object> detail : conflictMap.values()) {
                        List<String> crewNames = new List<String>();
                        for (String name : (List<String>)detail.get('crewNames')) {
                            if (!String.isBlank(name)) {
                                crewNames.add(name);
                            }
                        }
                        detail.put('crewNameSummary', crewNames.isEmpty() ? null : String.join(crewNames, ', '));
                        conflictDetails.add(detail);
                    }

                    response.put('status', 'CONFLICT');
                    response.put('message', 'Selected members are already assigned to another crew.');
                    response.put('conflicts', conflictDetails);
                    return response;
                }
            }

            if (crewRecord.Id == null) {
                insert crewRecord;
            } else {
                update crewRecord;
            }

            crewId = crewRecord.Id;

            List<Crew_Member__c> existingMembers = crewId == null
                ? new List<Crew_Member__c>()
                : [
                    SELECT Id, Contact__c
                    FROM Crew_Member__c
                    WHERE Crew__c = :crewId
                    WITH USER_MODE
                ];

            Map<Id, Crew_Member__c> existingByContact = new Map<Id, Crew_Member__c>();
            for (Crew_Member__c member : existingMembers) {
                existingByContact.put(member.Contact__c, member);
            }

            List<Crew_Member__c> membersToInsert = new List<Crew_Member__c>();
            for (Id contactId : desiredMemberIds) {
                if (!existingByContact.containsKey(contactId)) {
                    membersToInsert.add(new Crew_Member__c(Crew__c = crewId, Contact__c = contactId));
                }
            }

            List<Crew_Member__c> membersToDelete = new List<Crew_Member__c>();
            for (Crew_Member__c member : existingMembers) {
                if (!desiredMemberIds.contains(member.Contact__c)) {
                    membersToDelete.add(member);
                }
            }

            if (!membersToInsert.isEmpty()) {
                insert membersToInsert;
            }

            if (!membersToDelete.isEmpty()) {
                delete membersToDelete;
            }

            response.put('status', 'SUCCESS');
            response.put('message', 'Crew saved successfully.');
            response.put('crewId', crewId);
            response.put('memberCount', desiredMemberIds.size());
            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'saveCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error saving Crew : ' + e.getMessage(), 'apiResponse' => null});
            response.put('message', 'Error: ' + e.getMessage());
            return response;
        }
    }

    @AuraEnabled
    public static String deleteProcess(String processId) {
        try {
            
            if (processId != null) {
                delete as user (new Process__c(Id = processId));
                return 'Success';
            } else {
                return 'Process not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Process : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static Process__c upsertProcess(Process__c processRecord) {
        try {
            if (processRecord != null) {
                upsert as user processRecord;
                return processRecord;
            } else {
                throw new AuraHandledException('Process record is null');
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'upsertProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Process : ' + e.getMessage(), 'apiResponse' => null});
            throw new AuraHandledException('Error saving process: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getCrewContacts(Id crewId) {
        List<CrewContactDTO> assignedContacts = new List<CrewContactDTO>();
        List<CrewContactDTO> availableContacts = new List<CrewContactDTO>();

        Map<String, Object> response = new Map<String, Object>{
            'assignedContacts' => assignedContacts,
            'availableContacts' => availableContacts
        };

        try {
            List<Contact> crewCandidates = [
                SELECT Id, Name,
                    (SELECT Id, Crew__c, Crew__r.Name, Crew__r.Color_Code__c
                     FROM Crew_Members__r)
                FROM Contact
                WHERE RecordType.DeveloperName = 'Employee_WF_Recon'
                AND User__r.IsActive = true
                WITH USER_MODE
                ORDER BY Name
            ];

            for (Contact contactRecord : crewCandidates) {
                CrewContactDTO contactDto = new CrewContactDTO();
                contactDto.id = contactRecord.Id;
                contactDto.name = contactRecord.Name;
                contactDto.isAssignedElsewhere = false;
                contactDto.isAssignedToCurrentCrew = false;

                if (contactRecord.Crew_Members__r != null && !contactRecord.Crew_Members__r.isEmpty()) {
                    List<String> crewNames = new List<String>();

                    for (Crew_Member__c membership : contactRecord.Crew_Members__r) {
                        CrewMembershipDTO membershipDto = new CrewMembershipDTO();
                        membershipDto.crewId = membership.Crew__c;
                        membershipDto.crewName = membership.Crew__r != null ? membership.Crew__r.Name : null;
                        membershipDto.colorCode = membership.Crew__r != null ? membership.Crew__r.Color_Code__c : null;
                        contactDto.memberships.add(membershipDto);

                        if (membershipDto.crewName != null) {
                            crewNames.add(membershipDto.crewName);
                        }

                        if (crewId != null && membership.Crew__c == crewId) {
                            contactDto.isAssignedToCurrentCrew = true;
                        } else if (membership.Crew__c != null) {
                            contactDto.isAssignedElsewhere = true;
                        }

                        if (String.isBlank(contactDto.primaryCrewColor) && !String.isBlank(membershipDto.colorCode)) {
                            contactDto.primaryCrewColor = membershipDto.colorCode;
                        }
                    }

                    contactDto.assignedCrewNames = crewNames.isEmpty() ? null : String.join(crewNames, ', ');
                }

                if (contactDto.isAssignedToCurrentCrew) {
                    assignedContacts.add(contactDto);
                } else {
                    availableContacts.add(contactDto);
                }
            }

            availableContacts.sort();
            assignedContacts.sort();
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewContacts', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching crew contacts : ' + e.getMessage(), 'apiResponse' => null});
        }

        return response;
    }

    @AuraEnabled
    public static String deleteCrew(String crewId) {
        try {
            if (crewId != null) {
                delete as user (new Crew__c(Id = crewId));  
                return 'Success';
            } else {
                return 'Crew not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Crew : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static List<Cost_Code__c> getCostCodes() {
        List<Cost_Code__c> costCodes = new List<Cost_Code__c>();
        
        try {
            costCodes = [
                SELECT Id, Name, Classification_Type__c, Code__c, Level_Code__c
                FROM Cost_Code__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCostCodes', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Cost Codes : ' + e.getMessage(), 'apiResponse' => null});
        }

        return costCodes;
    }

    @AuraEnabled
    public static String deleteCostCode(String costCodeId) {
        try {
            if (costCodeId != null) {
                delete as user (new Cost_Code__c(Id = costCodeId));
                return 'Success';
            } else {
                return 'Cost Code not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    public class CrewMembershipDTO {
        @AuraEnabled public Id crewId;
        @AuraEnabled public String crewName;
        @AuraEnabled public String colorCode;
    }

    public class CrewContactDTO implements Comparable {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Boolean isAssignedElsewhere;
        @AuraEnabled public Boolean isAssignedToCurrentCrew;
        @AuraEnabled public String assignedCrewNames;
        @AuraEnabled public String primaryCrewColor;
        @AuraEnabled public List<CrewMembershipDTO> memberships = new List<CrewMembershipDTO>();

        public Integer compareTo(Object obj) {
            CrewContactDTO other = (CrewContactDTO)obj;
            Boolean thisAssignedElsewhere = this.isAssignedElsewhere == null ? false : this.isAssignedElsewhere;
            Boolean otherAssignedElsewhere = other.isAssignedElsewhere == null ? false : other.isAssignedElsewhere;

            if (thisAssignedElsewhere != otherAssignedElsewhere) {
                return thisAssignedElsewhere ? 1 : -1;
            }

            String thisName = this.name == null ? '' : this.name.toLowerCase();
            String otherName = other.name == null ? '' : other.name.toLowerCase();
            return thisName.compareTo(otherName);
        }
    }
}