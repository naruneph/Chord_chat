class Time {
	constructor() {
		this.begins = {};
	}

	start(id = "standart") {
		return (this.begins[id] = Date.now());
	}

	end(id = "standart") {
		let dt = Date.now() - this.begins[id];

		console.log(`Time needed for ${id} is ${dt} ms`);

		return dt;
	}
};

module.exports = Time;