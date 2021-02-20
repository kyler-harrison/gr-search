function getQuery(query) {
	// TODO load spinny image

	if (query.length == 0) {
		$(".search-container").append("<div class='return-message'>hey</div>");
	} else {
		$.ajax({
			url: "http://localhost:3000",
			type: "GET",
			data: {search: query},
			success: (result) => {
				console.log("success");
				console.log(result);
				// TODO stop displaying load spinny image
				// TODO display data returned
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
