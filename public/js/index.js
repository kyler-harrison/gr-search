String.prototype.format = function() {
    var s = this,
        i = arguments.length;

    while (i--) {
		        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
		    }
    return s;
}

function getQuery(query) {
	// TODO load spinny image
	
	// clear out any elems/messages for each new query
	var messageContainer = ".main-message-container";
	$(messageContainer).empty();
	var baseElemId = "#base-results-container";  
	$(baseElemId).empty();  

	if (query.length == 0) {
		var returnMsgElem = "<div class='return-message'>Well... I need a description to make recommendations... So... Describe something.</div>"
		$(messageContainer).append(returnMsgElem);

	} else {
		$.ajax({
			url: "http://localhost:3000",
			type: "GET",
			data: {search: query},
			success: (result) => {
				// TODO stop displaying load spinny image

				console.log(result);
				var message = result.message;
				var resStatus = result.resStatus;

				// if no error has been returned: display data
				if (resStatus == "valid") {
					var dataArr = result.dataArr;
					for (var dataObj of dataArr) {
						var dataId = "title" + Math.floor(Math.random() * 100000);
						var dataBaseElem = "<div id='{0}' class='result-container'>{1}<div class='subby'>urmom</div></div>".format(dataId, dataObj['unfiltered_title']);
						// TODO now append the sub elems of the main data elem

						$(baseElemId).append(dataBaseElem);
					}
				} else {
					console.log("we hit the else");
					$(baseElemId).append("<div class='return-message'>" + message + "</div");
				}
			}
		});
	}
}

$(document).on("keypress", (key) => {
	if (key.which == 13) {
		var input = $(".input-box").val();
		getQuery(input);
	}
});

$(".ask-button").click(() => {
	var input = $(".input-box").val();
	getQuery(input);
});
