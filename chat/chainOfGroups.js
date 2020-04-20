function ChainOfGroups ($_, context){

    this.context = context;
    this.myID = chat.id;
    this.friendID = undefined;
    this.chains = undefined; 

    this.init = function (friendID, groups){

        this.friendID = friendID;
        this.chains = this.findAllChains(groups);
    };

    
    this.findAllChains = function(groups){
        var grList1 = groupList(this.myID, groups);
        var grList2 = groupList(this.friendID, groups);

        var rvList = [].concat(grList1); // recently viewed groups
        var output = []; 

        if(grList1.length && grList2.length){
            var intersectionList = intersection(grList1, grList2);
            if(intersectionList.length){
                output.push([intersectionList[0]]);
            } else {
                var i = 0;
                while(i < grList1.length){
                    var resList = []; 
                    path_1(rvList, grList1[i], grList2, resList, groups, output);
                    i++;
                }
            }
        }

        return output;
    };

    function path_1(rvList, gr, grList2, resList, groups, output){

        var local_resList = [].concat(resList);

        var new_grList1 = difference(neighbours(gr, groups), rvList);
        var new_rvList = union(rvList, new_grList1);
        var intersectionList = intersection(new_grList1, grList2);
        
        local_resList.push(gr);


        if(intersectionList.length){
            local_resList.push(intersectionList[0]);
            output.push(local_resList);
        } else {
            var i = 0;
            while(i < new_grList1.length){
                path_1(new_rvList, new_grList1[i], grList2, local_resList, groups, output);
                i++;
            }
        }
    }


    

    
    this.findDistance = function(groups){
        var dist = 0;

        var grList1 = groupList(this.myID, groups);
        var grList2 = groupList(this.friendID, groups);

        if(grList1.length && grList2.length){

            dist++;
            var fullList = [].concat(grList1);
            var intersectionList = intersection(fullList, grList2);

            var newList;
            while(grList1.length && !intersectionList.length){
                dist++;
                newList = [];
                for(let group of grList1){
                    newList = union(newList, neighbours(group, groups));
                }
                grList1 = difference(newList, fullList);
                fullList = union(fullList, grList1);
                intersectionList = intersection(fullList, grList2);
            }

            if(!grList1.length){
                dist = 0;
            }
        }

        return dist;
        
    };

    this.findShortestChain = function(groups, dist){
        var grList1 = groupList(this.myID, groups);
        var grList2 = groupList(this.friendID, groups);

        var rvList = []; // recently viewed groups
        var resList = []; 

        var curlen = 1;

        path(rvList, grList1, grList2, dist, curlen, resList, groups);

        return resList;
    };

    function path(rvList, grList1, grList2, dist, curlen, resList, groups){
        var res, i, gr;
        var new_rvList = [];
        var new_grList1 = [];
        var new_resList = [];
        resList.length = 0;

        if(!grList1.length || !grList2.length){
            res = false;
        } else {
            var intersectionList = intersection(grList1, grList2);
            if(intersectionList.length){
                resList.push(intersectionList[0]);
                res = true;
            } else {
                i = 0;
                res = false;
                while( i < grList1.length && !res && (curlen < dist) ){
                    gr = grList1[i];
                    new_resList.length = 0;
                    new_rvList = union(rvList, grList1);
                    new_grList1 = difference(neighbours(gr, groups), new_rvList);
                    res = path(new_rvList, new_grList1, grList2, dist, curlen + 1, new_resList, groups);
                    i++;
                }
                if(res){
                    union([gr], new_resList).forEach(el => resList.push(el));
                }
            }
        }

        return res;
    }




    function groupList(id, groups){
        let list = [];
        for(let group of groups){
            if(group.idList.includes(id)){
                list.push(group);
            }
        }
        return list;
    }

    function neighbours(gr, groups){
        var list = [];
        for(let id of gr.idList){
            list = union(list, groupList(id, groups));
        } 
        return difference(list, [gr]);
    }

    function intersection(grList1, grList2){
        let list = grList1.filter( el => {
            for(var i = 0; i < grList2.length; i++){
              if(el.roomId === grList2[i].roomId){
                return true;
              }
            }
            return false;
        });
        return list;
    }

    function union(grList1, grList2){
        let list = grList1.concat(grList2);
        return [...new Map(list.map(item => [item["roomId"], item])).values()]
    }

    function difference(grList1, grList2){
        let list = grList1.filter( el => {
            for(var i = 0; i < grList2.length; i++){
              if(el.roomId === grList2[i].roomId){
                return false;
              }
            }
            return true;
        });
        return list;
    }
    

}

module.exports = ChainOfGroups;